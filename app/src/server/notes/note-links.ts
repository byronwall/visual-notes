import type { NoteDoc, NoteNode } from "~/lib/note-content/types";
import { prisma } from "~/server/db";

const LABEL_MAX = 80;

const clip = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX - 1)}…` : flat;
};

function collectLinks(node: NoteNode, out: NoteNode[]) {
  if (node.type === "noteLink") out.push(node);
  for (const child of node.content ?? []) collectLinks(child, out);
}

/**
 * Refreshes every note link's label from its target's current title (or the
 * linked block's text) and flags links whose target is gone. A block that
 * moved to another note is followed there. Returns a new document.
 */
export async function resolveNoteLinks(doc: NoteDoc): Promise<NoteDoc> {
  const links: NoteNode[] = [];
  collectLinks(doc, links);
  if (links.length === 0) return doc;

  const docIds = [...new Set(links.map((l) => String(l.attrs?.docId ?? "")))];
  const blockIds = [
    ...new Set(
      links.map((l) => l.attrs?.blockId).filter(Boolean) as string[],
    ),
  ];
  const [docs, blocks] = await Promise.all([
    prisma.doc.findMany({
      where: { id: { in: docIds } },
      select: { id: true, title: true },
    }),
    blockIds.length
      ? prisma.docBlock.findMany({
          where: { id: { in: blockIds } },
          select: { docId: true, id: true, text: true },
        })
      : Promise.resolve([]),
  ]);
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const blockKey = (docId: string, id: string) => `${docId}:${id}`;
  const blockText = new Map(blocks.map((b) => [blockKey(b.docId, b.id), b.text]));
  const blockHome = new Map<string, string>();
  for (const b of blocks) if (!blockHome.has(b.id)) blockHome.set(b.id, b.docId);
  const movedTitles = new Map<string, string>();
  const movedDocIds = [...new Set(blocks.map((b) => b.docId))].filter(
    (id) => !titles.has(id),
  );
  if (movedDocIds.length) {
    const moved = await prisma.doc.findMany({
      where: { id: { in: movedDocIds } },
      select: { id: true, title: true },
    });
    for (const d of moved) movedTitles.set(d.id, d.title);
  }

  const resolve = (attrs: Record<string, any>): Record<string, any> => {
    let docId = String(attrs.docId ?? "");
    const blockId = attrs.blockId ? String(attrs.blockId) : null;
    if (!blockId) {
      const title = titles.get(docId);
      return title === undefined
        ? { ...attrs, missing: true }
        : { ...attrs, label: clip(title), missing: false };
    }
    let text = blockText.get(blockKey(docId, blockId));
    if (text === undefined && blockHome.has(blockId)) {
      docId = blockHome.get(blockId)!;
      text = blockText.get(blockKey(docId, blockId));
    }
    const title = titles.get(docId) ?? movedTitles.get(docId);
    if (text === undefined || title === undefined) {
      return { ...attrs, missing: true };
    }
    return { ...attrs, docId, label: clip(text || title), missing: false };
  };

  const visit = (node: NoteNode): NoteNode => {
    if (node.type === "noteLink") return { ...node, attrs: resolve(node.attrs ?? {}) };
    if (!node.content) return node;
    return { ...node, content: node.content.map(visit) };
  };
  return visit(doc) as NoteDoc;
}

export type Backlink = {
  docId: string;
  title: string;
  path: string | null;
  updatedAt: string;
  blocks: { blockId: string; text: string; targetBlockId: string | null }[];
};

/** Notes that link to `docId` (or to a block in it), with the linking text. */
export async function listBacklinks(docId: string): Promise<Backlink[]> {
  const links = await prisma.docLink.findMany({
    where: { targetDocId: docId, NOT: { sourceDocId: docId } },
    select: {
      sourceDocId: true,
      sourceBlockId: true,
      targetBlockId: true,
      sourceDoc: { select: { title: true, path: true, updatedAt: true } },
    },
    take: 200,
  });
  if (links.length === 0) return [];
  const blocks = await prisma.docBlock.findMany({
    where: {
      OR: links.map((l) => ({ docId: l.sourceDocId, id: l.sourceBlockId })),
    },
    select: { docId: true, id: true, text: true },
  });
  const text = new Map(blocks.map((b) => [`${b.docId}:${b.id}`, b.text]));
  const grouped = new Map<string, Backlink>();
  for (const l of links) {
    let entry = grouped.get(l.sourceDocId);
    if (!entry) {
      entry = {
        docId: l.sourceDocId,
        title: l.sourceDoc.title,
        path: l.sourceDoc.path,
        updatedAt: l.sourceDoc.updatedAt.toISOString(),
        blocks: [],
      };
      grouped.set(l.sourceDocId, entry);
    }
    if (entry.blocks.some((b) => b.blockId === l.sourceBlockId)) continue;
    entry.blocks.push({
      blockId: l.sourceBlockId,
      text: clip(text.get(`${l.sourceDocId}:${l.sourceBlockId}`) ?? ""),
      targetBlockId: l.targetBlockId,
    });
  }
  return [...grouped.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export type LinkTarget = {
  docId: string;
  blockId: string | null;
  label: string;
  /** Note title for block targets; path for note targets. */
  context: string | null;
  kind: "note" | "heading";
};

/** Notes by title, then headings by text, for the [[ link picker. */
export async function searchLinkTargets(
  rawQuery: string,
  excludeDocId?: string,
): Promise<LinkTarget[]> {
  const query = rawQuery.trim();
  const notes = await prisma.doc.findMany({
    where: {
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
      ...(excludeDocId ? { NOT: { id: excludeDocId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, path: true },
  });
  const headings = query
    ? await prisma.docBlock.findMany({
        where: {
          type: "heading",
          text: { contains: query, mode: "insensitive" },
        },
        take: 6,
        select: { docId: true, id: true, text: true, doc: { select: { title: true } } },
      })
    : [];
  return [
    ...notes.map((n) => ({
      docId: n.id,
      blockId: null,
      label: n.title,
      context: n.path,
      kind: "note" as const,
    })),
    ...headings.map((h) => ({
      docId: h.docId,
      blockId: h.id,
      label: clip(h.text),
      context: h.doc.title,
      kind: "heading" as const,
    })),
  ];
}

/** Every read-time refresh of references inside a note (links, tasks). */
export async function resolveNoteReferences(doc: NoteDoc): Promise<NoteDoc> {
  const { resolveTaskRefs } = await import("./inline-tasks");
  return resolveTaskRefs(await resolveNoteLinks(doc));
}
