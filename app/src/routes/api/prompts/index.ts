import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

const createPromptInput = z.object({
  task: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  defaultModel: z.string().min(1).optional(),
  defaultTemp: z.number().min(0).max(2).optional(),
  defaultTopP: z.number().min(0).max(1).optional(),
  template: z.string().min(1),
  system: z.string().optional(),
  modelOverride: z.string().optional(),
  tempOverride: z.number().min(0).max(2).optional(),
  topPOverride: z.number().min(0).max(1).optional(),
  activate: z.boolean().optional(),
});

export async function GET() {
  const items = await prisma.prompt.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      activeVersion: true,
    },
  });
  console.log(`[api/prompts] GET count=${items.length}`);
  return json({ items });
}

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = createPromptInput.parse(body);
    const prompt = await prisma.prompt.create({
      data: {
        task: input.task,
        description: input.description ?? null,
        defaultModel: input.defaultModel ?? "gpt-4o-mini",
        defaultTemp:
          typeof input.defaultTemp === "number" ? input.defaultTemp : 0.2,
        defaultTopP:
          typeof input.defaultTopP === "number" ? input.defaultTopP : null,
      },
    });
    const version = await prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        template: input.template,
        system: input.system ?? null,
        modelOverride: input.modelOverride ?? null,
        tempOverride:
          typeof input.tempOverride === "number" ? input.tempOverride : null,
        topPOverride:
          typeof input.topPOverride === "number" ? input.topPOverride : null,
      },
    });
    if (input.activate !== false) {
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { activeVersionId: version.id },
      });
    }
    const full = await prisma.prompt.findUnique({
      where: { id: prompt.id },
      include: { activeVersion: true },
    });
    console.log(`[api/prompts] created task=${prompt.task}`);
    return json({ item: full }, { status: 201 });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
