import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";

const inputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
});

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const { ids } = inputSchema.parse(body);
    // De-duplicate IDs to avoid redundant work
    const uniqueIds = Array.from(new Set(ids));
    console.log(
      "[api.docs.bulk-delete] deleting count=%d first=%s",
      uniqueIds.length,
      uniqueIds[0] || ""
    );
    const result = await prisma.doc.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    return json({ ok: true, deletedCount: result.count });
  } catch (e) {
    const msg = (e as Error).message || "Failed to bulk delete";
    return json({ error: msg }, { status: 400 });
  }
}
