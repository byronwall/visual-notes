import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const bodySchema = z.object({
  norm: z.string().min(1),
  // Optional human-readable ref; if missing, we'll use norm
  ref: z.string().min(1).optional(),
});

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await event.request.json();
    const input = bodySchema.parse(body);
    const { norm } = input;
    const ref = input.ref || norm;

    // Ensure Passage exists
    const passage = await prisma.passage.upsert({
      where: { norm },
      update: { ref },
      create: { norm, ref },
    });

    // Record an open event without plan/day context
    const created = await prisma.readingProgress.create({
      data: {
        done: true,
        user: { connect: { id: session.user.id } },
        passage: { connect: { id: passage.id } },
        // plan/day intentionally omitted and may be null per schema change
      } as unknown as Prisma.ReadingProgressCreateInput,
      select: {
        passageId: true,
        done: true,
        updatedAt: true,
      },
    });

    return json(created);
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
