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

export async function DELETE(event: APIEvent) {
  try {
    // Accept either JSON body or query param for originalSource
    const url = new URL(event.request.url);
    const querySource = url.searchParams.get("originalSource");
    let originalSource: string | null = null;

    if (event.request.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await event.request.json().catch(() => null);
        if (body && typeof body.originalSource === "string") {
          originalSource = body.originalSource;
        }
      } catch {}
    }

    if (!originalSource && querySource) originalSource = querySource;

    if (!originalSource) {
      return json({ error: "Missing originalSource" }, { status: 400 });
    }

    console.log("[api.docs.source.DELETE] deleting docs for source:%s", originalSource);
    const result = await prisma.doc.deleteMany({
      where: { originalSource },
    });
    return json({ ok: true, deletedCount: result.count });
  } catch (e) {
    const msg = (e as Error).message || "Failed to delete by source";
    return json({ error: msg }, { status: 400 });
  }
}
