import { action, json } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { applyCleanupResult } from "~/server/cleanup/apply";
import { draftDistill, type DistillDraft } from "~/server/cleanup/distill";
import { keepNote } from "~/server/cleanup/queue";
import { noteMarkdown } from "~/server/notes/note-store";
import {
  fetchCleanupItem,
  fetchCleanupOverview,
  fetchCleanupQueue,
} from "./cleanup.queries";

const docId = z.string().min(1);

/** Writes a distill draft for one note. Not cached: each call re-asks. */
export async function draftDistillForNote(id: string): Promise<DistillDraft> {
  "use server";
  const doc = await prisma.doc.findUnique({
    where: { id: docId.parse(id) },
    select: { title: true, markdown: true, html: true, content: true },
  });
  if (!doc) throw new Error("Not found");
  return draftDistill({
    docId: id,
    title: doc.title,
    markdown: noteMarkdown(doc),
  });
}

const destination = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("new"),
    title: z.string().max(200),
    path: z.string().max(512).nullable(),
  }),
  z.object({ kind: z.literal("existing"), docId }),
]);

const applyInput = z.object({
  docId,
  markdown: z.string().min(1).max(100_000),
  destination,
});

const queueKeys = () => [
  fetchCleanupOverview.key,
  fetchCleanupQueue.key,
  fetchCleanupItem.key,
];

export const applyDistillAction = action(
  async (input: z.input<typeof applyInput>) => {
    "use server";
    const parsed = applyInput.parse(input);
    const result = await applyCleanupResult({
      sourceIds: [parsed.docId],
      markdown: parsed.markdown,
      destination: parsed.destination,
      reason: "distill",
    });
    return json(result, { revalidate: queueKeys() });
  },
  "cleanup-apply-distill",
);

export const keepNoteAction = action(async (id: string) => {
  "use server";
  await keepNote(docId.parse(id));
  return json({ ok: true }, { revalidate: queueKeys() });
}, "cleanup-keep");
