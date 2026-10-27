import { prisma } from "~/server/db";
import { appendBlocks } from "~/server/mcp/note-content";
import { createNoteRecord } from "~/server/notes/create-note";
import type { ArchiveReason } from "~/server/notes/archive-window";
import { archiveNotes } from "~/server/notes/note-archive";
import { readNoteContent, revisionSnapshot } from "~/server/notes/note-store";
import { writeNoteContent } from "~/server/notes/note-write";

/**
 * Writes a cleanup result into a new or existing note, then archives the
 * source notes into it. The archive keeps every source for 30 days, so an
 * approve is always undoable from the archive page.
 */

export type Destination =
  | { kind: "new"; title: string; path: string | null }
  | { kind: "existing"; docId: string };

export const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function sourceLine(
  verb: string,
  titles: string[],
  when = new Date(),
): string {
  const list = titles.map((t) => `“${t}”`).join(", ");
  return `_${verb} from ${list} on ${when.toLocaleDateString("en-US", MONTH_DAY_YEAR)}._`;
}

/** Appends markdown to an existing note, keeping a revision of what was there. */
export async function appendMarkdown(docId: string, markdown: string) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.doc.findUnique({
      where: { id: docId },
      select: {
        title: true,
        path: true,
        markdown: true,
        html: true,
        content: true,
        archivedAt: true,
      },
    });
    if (!current || current.archivedAt)
      throw new Error("Target note not found");
    await tx.docRevision.create({
      data: {
        docId,
        ...revisionSnapshot(current),
        actorType: "magic_user",
        reason: "cleanup-append",
      },
    });
    await writeNoteContent(tx, {
      docId,
      doc: appendBlocks(readNoteContent(current), markdown),
      actorType: "magic_user",
    });
  });
}

const SOURCE_VERBS: Partial<Record<ArchiveReason, string>> = {
  distill: "Distilled",
  combine: "Combined",
  post_event: "Summarized",
};

/**
 * The markdown that lands in the destination: the result plus a line naming
 * the archived sources. Appended content gets a heading so it reads as its
 * own section of the existing note.
 */
export function resultMarkdown(input: {
  markdown: string;
  sourceTitles: string[];
  reason: ArchiveReason;
  heading?: string | null;
  when?: Date;
}): string {
  const verb = SOURCE_VERBS[input.reason] ?? "Moved";
  const parts = [
    input.heading ? `## ${input.heading}` : null,
    input.markdown.trim(),
    sourceLine(verb, input.sourceTitles, input.when),
  ];
  return parts.filter(Boolean).join("\n\n");
}

export async function applyCleanupResult(input: {
  sourceIds: string[];
  markdown: string;
  destination: Destination;
  reason: ArchiveReason;
}): Promise<{ targetId: string }> {
  const sources = await prisma.doc.findMany({
    where: { id: { in: input.sourceIds } },
    select: { id: true, title: true },
  });
  const sourceTitles = input.sourceIds.map(
    (id) => sources.find((s) => s.id === id)?.title ?? "Untitled note",
  );
  let targetId: string;
  if (input.destination.kind === "new") {
    const created = await createNoteRecord({
      title: input.destination.title.trim() || "Untitled note",
      markdown: resultMarkdown({ ...input, sourceTitles }),
      path: input.destination.path ?? undefined,
    });
    targetId = created.id;
  } else {
    targetId = input.destination.docId;
    const heading = sourceTitles.length === 1 ? sourceTitles[0] : null;
    await appendMarkdown(
      targetId,
      resultMarkdown({ ...input, sourceTitles, heading }),
    );
  }
  await archiveNotes({
    docIds: input.sourceIds,
    intoId: targetId,
    reason: input.reason,
  });
  await prisma.noteAssessment.updateMany({
    where: { docId: { in: input.sourceIds } },
    data: { decision: "done", decidedAt: new Date() },
  });
  return { targetId };
}
