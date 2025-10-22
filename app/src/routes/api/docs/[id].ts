import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

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
      const html = normalizeAiOutputToHtml(input.markdown);
      updates.markdown = input.markdown;
      updates.html = html;
    } else if (input.html) {
      // Accept raw HTML edits → sanitize before saving; keep prior markdown unchanged
      const sanitized = sanitizeHtml(String(input.html));
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
