import { getSession } from "@solid-mediakit/auth";
import type { APIEvent } from "@solidjs/start/server";
import { serverEnv } from "~/env/server";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

async function fetchESVHtmlServer(norm: string): Promise<string> {
  const BASE = "https://api.esv.org/v3/passage/html/";
  const params = new URLSearchParams({
    q: norm,
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
    const txt = await res.text();
    throw new Error(`ESV ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { passages: string[] };
  return json.passages.join("\n");
}

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });
  const query = new URL(event.request.url).searchParams.get("query");
  if (!query) return new Response("Missing query", { status: 400 });
  const norm = query.trim();
  const now = new Date();
  const existing = await prisma.passageCache.findUnique({ where: { norm } });
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (existing && existing.expiresAt.getTime() > now.getTime()) {
    return new Response(existing.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const html = await fetchESVHtmlServer(norm);
  const expiresAt = new Date(now.getTime() + sevenDaysMs);
  if (existing) {
    await prisma.passageCache.update({
      where: { norm },
      data: { html, expiresAt },
    });
  } else {
    await prisma.passageCache.create({ data: { norm, html, expiresAt } });
  }
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
