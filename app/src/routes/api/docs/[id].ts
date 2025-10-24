import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";

export async function GET(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  const doc = await prisma.doc.findUnique({
    where: { id },
  });
  if (!doc) return json({ error: "Not found" }, { status: 404 });
  // Attach embedding runs relevant to this doc with summarized results
  const embeddings = await prisma.docEmbedding.findMany({
    where: { docId: id },
    select: { runId: true, vector: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const runIds = Array.from(
    new Set((embeddings as any[]).map((e: any) => e.runId))
  );
  let runs: any[] = [];
  if (runIds.length) {
    runs = await prisma.embeddingRun.findMany({
      where: { id: { in: runIds } },
      select: {
        id: true,
        model: true,
        dims: true,
        params: true,
        createdAt: true,
      },
    });
  }
  const byRunId = new Map<string, any>(
    (runs as any[]).map((r: any) => [String(r.id), r])
  );
  const embeddingRuns = (embeddings as any[]).map((e: any) => {
    const run = byRunId.get(String(e.runId)) || { id: e.runId };
    const vector = Array.isArray(e.vector) ? e.vector : [];
    return {
      id: String(run.id),
      model: run.model,
      dims: run.dims,
      params: run.params,
      runCreatedAt: run.createdAt,
      embeddedAt: e.createdAt,
      vectorDims: vector.length,
      vectorPreview: vector.slice(0, 8),
    };
  });
  try {
    const html = String(doc.html || "");
    const imgCount = (html.match(/<img\b/gi) || []).length;
    const dataImgCount = (html.match(/<img[^>]*src=["']data:/gi) || []).length;
    console.log(
      "[api.docs.get] doc:%s html len:%d imgs:%d dataImgs:%d",
      id,
      html.length,
      imgCount,
      dataImgCount
    );
  } catch {}
  return json({ ...doc, embeddingRuns });
}

const putInput = z.object({
  title: z.string().min(1).max(200).optional(),
  markdown: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
});

export async function PUT(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  try {
    const body = await event.request.json();
    const input = putInput.parse(body);
    const updates: Record<string, any> = {};

    if (input.title !== undefined) updates.title = input.title;

    if (input.markdown) {
      // Source of truth as markdown → regenerate sanitized HTML
      const html = normalizeMarkdownToHtml(input.markdown);
      updates.markdown = input.markdown;
      updates.html = html;
    } else if (input.html) {
      // Accept raw HTML edits → sanitize before saving; keep prior markdown unchanged
      const sanitized = sanitizeHtmlContent(String(input.html));
      try {
        const beforeImgs = (String(input.html).match(/<img\b/gi) || []).length;
        const beforeDataImgs = (
          String(input.html).match(/<img[^>]*src=["']data:/gi) || []
        ).length;
        const afterImgs = (sanitized.match(/<img\b/gi) || []).length;
        const afterDataImgs = (
          sanitized.match(/<img[^>]*src=["']data:/gi) || []
        ).length;
        console.log(
          "[api.docs.put] doc:%s imgs:%d→%d dataImgs:%d→%d",
          id,
          beforeImgs,
          afterImgs,
          beforeDataImgs,
          afterDataImgs
        );
      } catch {}
      updates.html = sanitized;
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.doc.update({
      where: { id },
      data: updates,
      select: { id: true, updatedAt: true },
    });
    return json(updated, { status: 200 });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
