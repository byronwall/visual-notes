import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { testDatabaseEnabled as enabled, testDatabaseUrl as url } from "~/test/database";
import { contentColumns } from "~/server/notes/note-store";
import type { NoteDoc } from "~/lib/note-content/types";

const { client } = vi.hoisted(() => ({ client: { current: null as PrismaClient | null } }));
vi.mock("~/server/db", () => ({
  get prisma() {
    return client.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/server/note-events", () => ({ publishAppChange: vi.fn() }));

const { createAnnotation, listNoteAnnotations, saveAnchors } = await import("./annotations");
const { createAnnotationType, deleteAnnotationType, listAnnotationTypes, BUILT_IN } = await import(
  "./annotation-types"
);

const body: NoteDoc = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "The cat sat." }] }],
};

describe.skipIf(!enabled)("annotations (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const docIds: string[] = [];
  const typeIds: string[] = [];

  afterAll(async () => {
    if (!client.current) return;
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().annotationType.deleteMany({ where: { id: { in: typeIds } } });
    await prisma().$disconnect();
  });

  it("adds a highlight without changing the note's text, search text, or revisions", async () => {
    const doc = await prisma().doc.create({ data: { title: `Annotate ${Date.now()}`, ...contentColumns(body) } });
    docIds.push(doc.id);
    const created = await createAnnotation({ docId: doc.id, blockId: "p1", quote: "cat", quoteStart: 4, body: "Which cat?" });
    const after = await prisma().doc.findUniqueOrThrow({ where: { id: doc.id } });
    expect(after.content).toEqual(doc.content);
    expect(after.searchText).toBe(doc.searchText);
    expect(after.contentVersion).toBe(doc.contentVersion);
    expect(await prisma().docRevision.count({ where: { docId: doc.id } })).toBe(0);

    const types = await listAnnotationTypes();
    expect(created.typeId).toBe(types.find((t) => t.isDefault)!.id);

    await saveAnchors(doc.id, [{ id: created.id, blockId: "p1", quote: "cat", quoteStart: 4, endBlockId: null, endOffset: null, detached: true }]);
    expect((await listNoteAnnotations(doc.id))[0].detached).toBe(true);
  });

  it("keeps built-in types and moves a deleted type's annotations to the default", async () => {
    const types = await listAnnotationTypes();
    const request = types.find((t) => t.builtIn === BUILT_IN.request)!;
    expect(request.forAi).toBe(true);
    await expect(deleteAnnotationType(request.id)).rejects.toThrow(/built in/);

    const doc = await prisma().doc.create({ data: { title: `Types ${Date.now()}`, ...contentColumns(body) } });
    docIds.push(doc.id);
    const custom = await createAnnotationType({ name: `Idea ${Date.now()}`, color: "green", forAi: false });
    typeIds.push(custom.id);
    const note = await createAnnotation({ docId: doc.id, typeId: custom.id, body: "whole note" });
    await deleteAnnotationType(custom.id);
    const moved = await prisma().annotation.findUniqueOrThrow({ where: { id: note.id } });
    expect(moved.typeId).toBe(types.find((t) => t.isDefault)!.id);
  });
});
