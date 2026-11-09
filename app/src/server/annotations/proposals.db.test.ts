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

const { createProposal, listOpenProposals, resolveProposalOps } = await import("./proposals");

const body: NoteDoc = {
  type: "doc",
  content: [
    { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "One" }] },
    { type: "paragraph", attrs: { id: "p2" }, content: [{ type: "text", text: "Two" }] },
  ],
};

describe.skipIf(!enabled)("edit proposals (database)", () => {
  client.current = enabled ? new PrismaClient({ datasources: { db: { url } } }) : null;
  const prisma = () => client.current!;
  const docIds: string[] = [];

  const userNote = async () => {
    const doc = await prisma().doc.create({
      data: { title: `Proposal test ${Date.now()}`, ...contentColumns(body) },
    });
    docIds.push(doc.id);
    return doc;
  };

  afterAll(async () => {
    if (!client.current) return;
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("refuses an unknown block id and names the valid ones", async () => {
    const doc = await userNote();
    await expect(
      createProposal({ docId: doc.id, author: "Test", edits: [{ op: "delete", blockId: "nope" }] }),
    ).rejects.toThrow(/Unknown block id nope.*p1, p2/);
  });

  it("stores ops pending and resolves when none are left, without touching the note", async () => {
    const doc = await userNote();
    const proposal = await createProposal({
      docId: doc.id,
      author: "Test",
      summary: "Tighten",
      edits: [
        { op: "replace", blockId: "p1", blocks: [{ type: "paragraph", content: [{ type: "text", text: "Uno" }] }] },
        { op: "delete", blockId: "p2" },
      ],
    });
    expect(proposal.ops.map((op) => [op.op, op.state, Boolean(op.baseHash)])).toEqual([
      ["replace", "pending", true],
      ["delete", "pending", true],
    ]);
    expect(await listOpenProposals(doc.id)).toHaveLength(1);

    await resolveProposalOps({ proposalId: proposal.id, indexes: [0], state: "accepted" });
    expect(await listOpenProposals(doc.id)).toHaveLength(1);
    const done = await resolveProposalOps({ proposalId: proposal.id, indexes: [1], state: "rejected" });
    expect(done.ops.map((op) => op.state)).toEqual(["accepted", "rejected"]);
    expect(await listOpenProposals(doc.id)).toHaveLength(0);

    const after = await prisma().doc.findUniqueOrThrow({ where: { id: doc.id } });
    expect(after.contentVersion).toBe(doc.contentVersion);
    expect(after.content).toEqual(doc.content);
  });
});
