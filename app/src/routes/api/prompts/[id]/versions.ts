import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

const newVersionInput = z.object({
  template: z.string().min(1),
  system: z.string().optional(),
  modelOverride: z.string().optional(),
  tempOverride: z.number().min(0).max(2).optional(),
  topPOverride: z.number().min(0).max(1).optional(),
  activate: z.boolean().optional(),
});

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id!;
    const body = await event.request.json();
    const input = newVersionInput.parse(body);

    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt) return json({ error: "Not found" }, { status: 404 });

    const version = await prisma.promptVersion.create({
      data: {
        promptId: id,
        template: input.template,
        system: input.system ?? null,
        modelOverride: input.modelOverride ?? null,
        tempOverride: typeof input.tempOverride === "number" ? input.tempOverride : null,
        topPOverride: typeof input.topPOverride === "number" ? input.topPOverride : null,
      },
      select: { id: true },
    });
    if (input.activate) {
      await prisma.prompt.update({
        where: { id },
        data: { activeVersionId: version.id },
      });
    }
    console.log(`[api/prompts/:id/versions] created version for id=${id}`);
    return json({ id: version.id }, { status: 201 });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}


