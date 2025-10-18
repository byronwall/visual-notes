import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";
import { z } from "zod";
import { normalizeRef, splitRefs } from "~/utils/server-csv";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const [global, mine] = await Promise.all([
    prisma.plan.findMany({
      where: { isGlobal: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.plan.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return json({ global, mine });
}

const createInput = z.object({
  title: z.string().min(1).max(200),
  isGlobal: z.boolean().optional().default(false),
  rows: z.array(z.array(z.string())),
  headerHasDate: z.boolean().default(true),
  dateIdx: z.number().int().min(0).default(0),
});

export async function POST(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await event.request.json();
    const input = createInput.parse(body);
    const userId = session.user.id;
    const dataStart = input.headerHasDate ? 1 : 0;
    const dayCreates: any[] = [];
    let pos = 0;
    for (let i = dataStart; i < input.rows.length; i++) {
      const r = input.rows[i];
      if (!r || r.length === 0) continue;
      const rawDate = r[input.dateIdx];
      const label = rawDate || `Day ${i - dataStart + 1}`;
      const passages: { ref: string; norm: string }[] = [];
      for (let c = 0; c < r.length; c++) {
        if (c === input.dateIdx) continue;
        const cell = r[c];
        if (!cell) continue;
        splitRefs(cell).forEach((ref) =>
          passages.push({ ref, norm: normalizeRef(ref) })
        );
      }
      if (!passages.length) continue;
      dayCreates.push({
        position: ++pos,
        label,
        date: rawDate || null,
        passages: {
          create: passages.map((p, idx) => ({
            position: idx + 1,
            passage: {
              connectOrCreate: {
                where: { norm: p.norm },
                create: { norm: p.norm, ref: p.ref },
              },
            },
          })),
        },
      });
    }
    const created = await prisma.plan.create({
      data: {
        title: input.title,
        isGlobal: !!input.isGlobal,
        ownerId: input.isGlobal ? null : userId,
        days: { create: dayCreates },
      },
      select: { id: true },
    });
    return json({ id: created.id }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
