import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";
import { serverEnv } from "~/env/server";

const idParam = z.object({ id: z.string().min(1) });
const patchSchema = z.object({
  model: z.string().optional(),
  dims: z.number().int().positive().optional(),
  params: z.record(z.any()).optional(),
});

export async function GET(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  const url = new URL(event.request.url);
  const includeParam = (url.searchParams.get("include") || "").split(",");
  const includeDocs = includeParam.includes("docs");
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") || "50"))
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));

  const run = await prisma.embeddingRun.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      model: true,
      dims: true,
      params: true,
      createdAt: true,
    },
  });
  if (!run) return json({ error: "Not found" }, { status: 404 });
  const count = await prisma.docEmbedding.count({
    where: { runId: run.id },
  });
  const totalDocs = await prisma.doc.count();
  const remaining = Math.max(0, totalDocs - count);
  if (!includeDocs) return json({ ...run, count, remaining });

  // When requested, return a paginated list of note summaries included in this run
  const rows = await prisma.docEmbedding.findMany({
    where: { runId: run.id },
    select: { docId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });
  const docIds = rows.map((r: any) => r.docId);
  const docs = docIds.length
    ? await prisma.doc.findMany({
        where: { id: { in: docIds } },
        select: { id: true, title: true },
      })
    : [];
  const byId = new Map<string, { id: string; title: string }>(
    (docs as any[]).map((d: any) => [
      String(d.id),
      { id: String(d.id), title: String(d.title) },
    ])
  );
  const items = rows.map((r: any) => ({
    id: r.docId,
    title: byId.get(r.docId)?.title || "(untitled)",
    embeddedAt: r.createdAt,
  }));
  return json({ ...run, count, remaining, docs: { items, limit, offset } });
}

export async function PATCH(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  const body = patchSchema.safeParse(
    await event.request.json().catch(() => ({}))
  );
  if (!body.success)
    return json({ error: body.error.message }, { status: 400 });

  const updated = await prisma.embeddingRun
    .update({
      where: { id: parsed.data.id },
      data: body.data,
      select: {
        id: true,
        model: true,
        dims: true,
        params: true,
        createdAt: true,
      },
    })
    .catch(() => null);
  if (!updated) return json({ error: "Not found" }, { status: 404 });
  return json(updated);
}

export async function DELETE(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });
  // Delete embeddings then run
  await prisma.docEmbedding.deleteMany({
    where: { runId: parsed.data.id },
  });
  const deleted = await prisma.embeddingRun
    .delete({
      where: { id: parsed.data.id },
      select: { id: true },
    })
    .catch(() => null);
  if (!deleted) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true, id: deleted.id });
}

// Process additional (missing) docs for this embedding run
const processMoreSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
  model: z.string().optional(),
});

// Keep each input well under the model's context limit
const MAX_EMBED_INPUT_CHARS = 8000;
function truncateForEmbedding(text: string): string {
  return text.length > MAX_EMBED_INPUT_CHARS
    ? text.slice(0, MAX_EMBED_INPUT_CHARS)
    : text;
}

async function embedWithOpenAI(
  texts: string[],
  model: string
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(
      `OpenAI embeddings error ${res.status}: ${msg.slice(0, 400)}`
    );
  }
  const json = (await res.json()) as any;
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((d: any) => d.embedding as number[]);
}

export async function POST(event: APIEvent) {
  if (!serverEnv.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = processMoreSchema.parse(
      await event.request.json().catch(() => ({}))
    );
    const batchSize = Math.min(500, Math.max(1, body.limit ?? 100));

    const run = await prisma.embeddingRun.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, model: true, dims: true },
    });
    if (!run) return json({ error: "Not found" }, { status: 404 });

    // Determine which docs are not yet embedded for this run
    const embedded = await prisma.docEmbedding.findMany({
      where: { runId: run.id },
      select: { docId: true },
    });
    const embeddedIds = new Set<string>(
      embedded.map((e: any) => String(e.docId))
    );

    const docs = await prisma.doc.findMany({
      where: { id: { notIn: Array.from(embeddedIds) } },
      select: { id: true, title: true, markdown: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });

    if (!docs.length) {
      const totalDocs = await prisma.doc.count();
      const have = embeddedIds.size;
      return json({ added: 0, remaining: Math.max(0, totalDocs - have) });
    }

    const model = body.model || run.model;
    const inputs = docs.map((d: any) =>
      truncateForEmbedding(`${d.title}\n\n${d.markdown}`)
    );
    const vectors = await embedWithOpenAI(inputs, model);

    const now = new Date();
    const rows = docs.map((d: any, i: number) => ({
      runId: run.id,
      docId: d.id,
      vector: vectors[i] || [],
      createdAt: now,
    }));
    await prisma.docEmbedding.createMany({
      data: rows,
      skipDuplicates: true,
    });

    const totalDocs = await prisma.doc.count();
    const have = await prisma.docEmbedding.count({
      where: { runId: run.id },
    });
    return json(
      { added: rows.length, remaining: Math.max(0, totalDocs - have) },
      { status: 201 }
    );
  } catch (e) {
    const msg = (e as Error).message || "Failed to process more docs";
    return json({ error: msg }, { status: 400 });
  }
}
