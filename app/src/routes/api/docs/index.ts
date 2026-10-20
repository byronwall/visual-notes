import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { createNoteRecord } from "~/server/notes/create-note";

const jsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const createInput = z.object({
  title: z.string().min(1).max(200),
  markdown: z.string().min(1),
  path: z.string().max(512).optional(),
  meta: z.record(jsonPrimitive).optional(),
});

/** Creates one note from markdown for signed-in clients (used by e2e fixtures). */
export async function POST(event: APIEvent) {
  try {
    const input = createInput.parse(await event.request.json());
    const created = await createNoteRecord(input);
    return json(created, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}
