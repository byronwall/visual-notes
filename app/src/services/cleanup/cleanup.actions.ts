import { action, json } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { applyCleanupResult } from "~/server/cleanup/apply";
import { applyMove, draftCombine } from "~/server/cleanup/combine";
import { draftDistill, type DistillDraft } from "~/server/cleanup/distill";
import { keepNote, snoozeNote } from "~/server/cleanup/queue";
import { noteMarkdown } from "~/server/notes/note-store";
import {
  fetchCleanupItem,
  fetchCleanupOverview,
  fetchCleanupQueue,
  fetchNoteCleanupHint,
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
  fetchNoteCleanupHint.key,
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

export const snoozeNoteAction = action(async (id: string) => {
  "use server";
  await snoozeNote(docId.parse(id));
  return json({ ok: true }, { revalidate: queueKeys() });
}, "cleanup-snooze");

export async function draftCombineForCluster(input: {
  keepId: string | null;
  otherIds: string[];
}): Promise<DistillDraft> {
  "use server";
  const parsed = z
    .object({
      keepId: docId.nullable(),
      otherIds: z.array(docId).min(1).max(10),
    })
    .parse(input);
  return draftCombine(parsed);
}

const combineInput = z.object({
  memberIds: z.array(docId).min(2).max(10),
  markdown: z.string().min(1).max(200_000),
  destination,
});

export const applyCombineAction = action(
  async (input: z.input<typeof combineInput>) => {
    "use server";
    const parsed = combineInput.parse(input);
    const keepId =
      parsed.destination.kind === "existing" ? parsed.destination.docId : null;
    const result = await applyCleanupResult({
      sourceIds: parsed.memberIds.filter((id) => id !== keepId),
      markdown: parsed.markdown,
      destination: parsed.destination,
      reason: "combine",
    });
    if (keepId) {
      await prisma.noteAssessment.updateMany({
        where: { docId: keepId },
        data: { decision: "done", decidedAt: new Date() },
      });
    }
    return json(result, { revalidate: queueKeys() });
  },
  "cleanup-apply-combine",
);

const moveInput = z.object({
  docId,
  placement: z.object({
    kind: z.enum(["path", "collection"]),
    value: z.string().min(1).max(512),
    label: z.string(),
    p: z.number(),
  }),
});

export const applyMoveAction = action(
  async (input: z.input<typeof moveInput>) => {
    "use server";
    const parsed = moveInput.parse(input);
    await applyMove(parsed.docId, parsed.placement);
    return json({ ok: true }, { revalidate: queueKeys() });
  },
  "cleanup-apply-move",
);
