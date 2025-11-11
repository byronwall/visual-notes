import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

const activateInput = z.object({
  versionId: z.string().min(1),
});

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id!;
    const body = await event.request.json();
    const input = activateInput.parse(body);
    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt) return json({ error: "Not found" }, { status: 404 });
    await prisma.prompt.update({
      where: { id },
      data: { activeVersionId: input.versionId },
    });
    console.log(
      `[api/prompts/:id/activate] activated version=${input.versionId}`
    );
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
