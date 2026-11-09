import { splitGraph } from "~/lib/pathways/split";
import { emptyGraph } from "~/lib/pathways/types";
import { prisma } from "~/server/db";
import { noteMarkdown } from "~/server/notes/note-store";
import * as store from "./pathway-store";

// Starting a map from somewhere else in the app. Each source opens its
// existing map when there is one, so "Map this out" twice does not fork.

/** A map whose question is the task, linked back to the task. */
export async function startFromTask(taskId: string) {
  const existing = await prisma.pathway.findFirst({
    where: { sourceTaskId: taskId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const task = await prisma.taskItem.findUnique({
    where: { id: taskId },
    select: { description: true },
  });
  if (!task) throw new Error(`Task ${taskId} not found`);
  const p = await store.createPathway({
    title: task.description,
    sourceTaskId: taskId,
  });
  // The task shows the map on its row, like an exported step.
  await prisma.pathwayTaskLink.create({
    data: { pathwayId: p.id, taskId, nodeIds: ["root"] },
  });
  return { id: p.id, created: true };
}

/** A map about a note: its text goes into Goals & vibes for the agent to read. */
export async function startFromNote(docId: string) {
  const existing = await prisma.pathway.findFirst({
    where: { sourceDocId: docId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { title: true, content: true, html: true, markdown: true },
  });
  if (!doc) throw new Error(`Note ${docId} not found`);
  // Markdown, so Goals & vibes keeps the note's headings and lists.
  const text = noteMarkdown(doc).trim().slice(0, 6000);
  const title = `What do I do with “${doc.title.trim() || "this note"}”?`;
  const p = await store.createPathway({
    title,
    graph: emptyGraph(title),
    sourceDocId: docId,
    context: { notes: `From the note “${doc.title}”:\n\n${text}`, qa: [] },
  });
  return { id: p.id, created: true };
}

/**
 * A new map from one card of another: the card becomes the question and the
 * cards after it come along. Goals carry over, with a link back. The source
 * map stays as it is.
 */
export async function splitFromCard(pathwayId: string, nodeId: string) {
  const src = await store.getPathway(pathwayId);
  if (!src) throw new Error(`Pathway ${pathwayId} not found`);
  const graph = splitGraph(src.graph, nodeId);
  const from = `Split from the map [${src.title}](/pathways/${src.id}).`;
  const p = await store.createPathway({
    title: graph.nodes[0].title,
    graph,
    context: {
      notes: src.context?.notes.trim()
        ? `${from}\n\n${src.context.notes}`
        : from,
      qa: src.context?.qa ?? [],
    },
  });
  console.info("[pathways] split %s:%s into %s", src.id, nodeId, p.id);
  return { id: p.id };
}
