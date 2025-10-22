import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

const bodySchema = z.object({
  originalSource: z.string().min(1).max(128),
});

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = bodySchema.parse(body);

    const result = await prisma.doc.updateMany({
      data: { originalSource: input.originalSource },
    });

    return json({ ok: true, updatedCount: result.count });
  } catch (e) {
    const msg = (e as Error).message || "Failed to update source";
    return json({ error: msg }, { status: 400 });
  }
}
