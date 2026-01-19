import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const id = event.params.id!;
  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: {
      activeVersion: true,
      versions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!prompt) return json({ error: "Not found" }, { status: 404 });
  console.log(`[api/prompts/:id] GET id=${id}`);
  return json({ item: prompt });
}

const putInput = z.object({
  task: z.string().min(1).max(128).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultModel: z.string().min(1).optional(),
  defaultTemp: z.number().min(0).max(2).optional(),
  // allow null to clear it
  defaultTopP: z.number().min(0).max(1).nullable().optional(),
});

export async function PUT(event: APIEvent) {
  try {
    const id = event.params.id!;
    const body = await event.request.json();
    const input = putInput.parse(body);
    const updates: Record<string, unknown> = {};
    if (input.task !== undefined) updates.task = input.task;
    if (input.description !== undefined)
      updates.description = input.description;
    if (input.defaultModel !== undefined)
      updates.defaultModel = input.defaultModel;
    if (input.defaultTemp !== undefined)
      updates.defaultTemp = input.defaultTemp;
    if (input.defaultTopP !== undefined)
      updates.defaultTopP = input.defaultTopP;

    if (Object.keys(updates).length === 0) {
      return json({ error: "No valid fields" }, { status: 400 });
    }
    const updated = await prisma.prompt.update({
      where: { id },
      data: updates,
      select: { id: true, updatedAt: true },
    });
    console.log(`[api/prompts/:id] PUT id=${id}`);
    return json(updated, { status: 200 });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const id = event.params.id!;
    const existing = await prisma.prompt.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return json({ error: "Not found" }, { status: 404 });

    const [, , deleted] = await prisma.$transaction([
      prisma.prompt.update({
        where: { id },
        data: { activeVersionId: null },
        select: { id: true },
      }),
      prisma.promptVersion.deleteMany({ where: { promptId: id } }),
      prisma.prompt.delete({ where: { id }, select: { id: true } }),
    ]);

    console.log(`[api/prompts/:id] DELETE id=${id}`);
    return json({ id: deleted.id }, { status: 200 });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
