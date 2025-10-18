import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { z } from "zod";

const idParam = z.object({ id: z.string().min(1) });
const patchSchema = z.object({
  dims: z.union([z.literal(2), z.literal(3)]).optional(),
  params: z.record(z.any()).optional(),
});

export async function GET(event: APIEvent) {
  const id =
    event.params?.id || new URL(event.request.url).pathname.split("/").pop();
  const parsed = idParam.safeParse({ id });
  if (!parsed.success) return json({ error: "Invalid id" }, { status: 400 });

  const run = await (prisma as any).umapRun.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      dims: true,
      params: true,
      embeddingRunId: true,
      createdAt: true,
    },
  });
  if (!run) return json({ error: "Not found" }, { status: 404 });
  const count = await (prisma as any).umapPoint.count({
    where: { runId: run.id },
  });
  return json({ ...run, count });
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

  const updated = await (prisma as any).umapRun
    .update({
      where: { id: parsed.data.id },
      data: body.data,
      select: {
        id: true,
        dims: true,
        params: true,
        embeddingRunId: true,
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
  await (prisma as any).umapPoint.deleteMany({
    where: { runId: parsed.data.id },
  });
  const deleted = await (prisma as any).umapRun
    .delete({
      where: { id: parsed.data.id },
      select: { id: true },
    })
    .catch(() => null);
  if (!deleted) return json({ error: "Not found" }, { status: 404 });
  return json({ ok: true, id: deleted.id });
}
