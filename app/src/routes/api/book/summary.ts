import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import { generateBookSummary } from "~/server/features/bookSummary";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(event.request.url);
  const book = (url.searchParams.get("book") || "").trim();
  const cachedOnly = url.searchParams.get("cachedOnly") === "1";
  const refresh = url.searchParams.get("refresh") === "1";
  if (!book) return json({ error: "Missing book" }, { status: 400 });

  // Look up existing book summary
  const existing = await (prisma as any).aiBookSummary.findUnique({
    where: { book },
  });
  if (existing && !refresh) {
    const safeHtml = normalizeAiOutputToHtml(existing.html || "");
    return json({ book, html: safeHtml, model: existing.model });
  }
  if (cachedOnly) return json({ error: "Not found" }, { status: 404 });

  try {
    const ai = await generateBookSummary({
      book,
      userId: session.user?.id as string | undefined,
    });
    const saved = await (prisma as any).aiBookSummary.upsert({
      where: { book },
      update: { html: normalizeAiOutputToHtml(ai.html || ""), model: ai.model },
      create: {
        book,
        html: normalizeAiOutputToHtml(ai.html || ""),
        model: ai.model,
      },
      select: { html: true, model: true },
    });
    return json(
      { book, html: saved.html, model: saved.model },
      {
        status: existing ? 200 : 201,
      }
    );
  } catch (err) {
    console.error("[book-summary] generation failed", err);
    const message = (err as Error)?.message || "AI book summary failed";
    return json({ error: message }, { status: 502 });
  }
}
