import { serverEnv } from "~/env/server";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";
import { addNotes } from "~/server/collections/collection-store";
import { logActionEvent } from "~/server/events/action-events";
import { noteMarkdown } from "~/server/notes/note-store";
import {
  DISTILL_MODEL,
  LOCAL_EXTRACT_MODEL,
  type DistillDraft,
} from "./distill";
import { cleanBody } from "./note-state";
import type { Placement } from "./regroup";

/**
 * Combine: write what the other notes in a cluster add to the note being
 * kept (or to a new note), so the rest can be archived into it.
 */

const SOURCE_CAP = 8_000;
const LOCAL_CAP = 1_500;

const SYSTEM = `You merge related notes for the owner of a personal knowledge base.
"keep" is the note that stays (it may be null for a brand new note). "others" are notes that will be archived into it.
Write only what the others add that "keep" does not already say: concrete facts, decisions, commands, settings, numbers, and gotchas, grouped under short "###" headings when there is more than one topic. Never repeat what "keep" says. Drop chat framing and generic advice.
Reply with markdown only.`;

type Source = { id: string; title: string; markdown: string };

async function loadSources(ids: string[]): Promise<Source[]> {
  const rows = await prisma.doc.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      markdown: true,
      html: true,
      content: true,
    },
  });
  return ids.flatMap((id) => {
    const row = rows.find((r) => r.id === id);
    return row ? [{ id, title: row.title, markdown: noteMarkdown(row) }] : [];
  });
}

/** Each other note under its own heading, trimmed; no model call. */
export function localCombine(others: Source[]): string {
  return others
    .map((o) => {
      const body = cleanBody(o.markdown)
        .replace(/^Link back:.*$/gim, "")
        .trim();
      const clipped =
        body.length > LOCAL_CAP ? `${body.slice(0, LOCAL_CAP)}…` : body;
      return `### ${o.title}\n\n${clipped}`;
    })
    .join("\n\n");
}

export async function draftCombine(input: {
  keepId: string | null;
  otherIds: string[];
}): Promise<DistillDraft> {
  const [keep] = input.keepId ? await loadSources([input.keepId]) : [];
  const others = await loadSources(input.otherIds);
  const title = keep?.title ?? others[0]?.title ?? "Combined note";
  if (!serverEnv.OPENAI_API_KEY?.trim()) {
    return {
      title,
      markdown: localCombine(others),
      model: LOCAL_EXTRACT_MODEL,
    };
  }
  const { output } = await callLLM({
    model: DISTILL_MODEL,
    system: SYSTEM,
    user: JSON.stringify({
      keep: keep
        ? {
            title: keep.title,
            body: cleanBody(keep.markdown).slice(0, SOURCE_CAP),
          }
        : null,
      others: others.map((o) => ({
        title: o.title,
        body: cleanBody(o.markdown).slice(0, SOURCE_CAP),
      })),
    }),
    noteId: input.keepId ?? input.otherIds[0],
  });
  const markdown = output?.trim();
  return markdown
    ? { title, markdown, model: DISTILL_MODEL }
    : { title, markdown: localCombine(others), model: LOCAL_EXTRACT_MODEL };
}

/** Files a note into a path or collection; nothing is archived. */
export async function applyMove(docId: string, placement: Placement) {
  if (placement.kind === "collection") {
    await addNotes(placement.value, [docId]);
  } else {
    await prisma.doc.update({
      where: { id: docId },
      data: { path: placement.value },
    });
    await logActionEvent({
      eventType: "doc.update",
      entityType: "doc",
      entityId: docId,
      relatedDocId: docId,
      payload: { fieldsChanged: ["path"], source: "cleanup.regroup" },
    });
  }
  await prisma.noteAssessment.updateMany({
    where: { docId },
    data: { decision: "done", decidedAt: new Date() },
  });
}
