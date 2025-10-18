import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import { serverEnv } from "~/env/server";
import { generateChapterSummary } from "~/server/features/chapterSummary";
import {
  normalizeAiOutputToHtml,
  looksLikeMarkdown,
  looksLikeHtml,
} from "~/server/lib/markdown";

function firstChapterKey(norm: string): { ref: string } | null {
  // Normalize fancy dashes to hyphen
  const normalized = norm.replace(/\u2013|\u2014/g, "-").trim();
  const m = normalized.match(/^(.*?)(\s\d.*)$/);
  if (!m) return null;
  const book = m[1].trim();
  const rest = m[2].trim();
  const chMatch = rest.match(/^(\d+)/);
  if (!chMatch) return null;
  const ch = Number(chMatch[1]);
  if (!Number.isFinite(ch)) return null;
  const ref = `${book} ${ch}`;
  return { ref };
}

async function fetchESVHtmlFor(ref: string): Promise<string> {
  const BASE = "https://api.esv.org/v3/passage/html/";
  const params = new URLSearchParams({
    q: ref,
    "include-footnotes": "false",
    "include-headings": "true",
    "include-verse-numbers": "true",
    "include-short-copyright": "true",
    "indent-poetry": "true",
    "include-passage-references": "true",
  });
  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Authorization: `Token ${serverEnv.ESV_API_KEY}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ESV ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as any;
  return json.passages.join("\n");
}

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(event.request.url);
  const query = url.searchParams.get("query");
  const cachedOnly = url.searchParams.get("cachedOnly") === "1";
  const refresh = url.searchParams.get("refresh") === "1";
  if (!query) return json({ error: "Missing query" }, { status: 400 });

  const keyInfo = firstChapterKey(query.trim());
  if (!keyInfo)
    return json({ error: "Invalid passage reference" }, { status: 400 });
  const { ref } = keyInfo;

  // Find or create Passage by norm/ref, then check AiSummary by passageId
  const passage = await prisma.passage.upsert({
    where: { norm: ref },
    update: { ref },
    create: { norm: ref, ref },
  });
  const existing = await prisma.aiSummary.findUnique({
    where: { passageId: passage.id },
  });
  if (existing && !refresh) {
    // Normalize on read in case legacy rows contain markdown or fenced output
    const safeHtml = normalizeAiOutputToHtml(existing.html || "");
    return json({
      passageId: passage.id,
      ref: passage.ref,
      html: safeHtml,
      model: existing.model,
    });
  }
  if (cachedOnly) return json({ error: "Not found" }, { status: 404 });

  try {
    const passageHtml = await fetchESVHtmlFor(ref);
    const ai = await generateChapterSummary({
      book: ref.replace(/\s+\d+$/, ""),
      chapter: Number(ref.split(" ").pop()),
      passageHtml,
      passageId: passage.id,
      userId: session.user?.id as string | undefined,
    });

    const saved = await prisma.aiSummary.upsert({
      where: { passageId: passage.id },
      update: {
        html: normalizeAiOutputToHtml(ai.html || ""),
        model: ai.model || null,
      },
      create: {
        passageId: passage.id,
        html: normalizeAiOutputToHtml(ai.html || ""),
        model: ai.model || null,
      },
      select: { html: true, model: true },
    });
    return json(
      {
        passageId: passage.id,
        ref: passage.ref,
        html: saved.html,
        model: saved.model,
      },
      { status: existing ? 200 : 201 }
    );
  } catch (err) {
    console.error("[summary] generation failed", err);
    const message = (err as Error)?.message || "AI summary failed";
    return json({ error: message }, { status: 502 });
  }
}
