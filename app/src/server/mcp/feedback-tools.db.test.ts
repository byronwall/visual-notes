import { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  testDatabaseEnabled as enabled,
  testDatabaseUrl as url,
} from "~/test/database";

// feedback_submit is only useful if the user sees the report: it must land
// at the fixed path as an open task in the Tasks inbox.

const { client: db } = vi.hoisted(() => ({
  client: { current: null as PrismaClient | null },
}));
vi.mock("~/server/db", () => ({
  get prisma() {
    return db.current;
  },
}));
vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/features/docs-index/data/docs.queries.search", () => ({
  searchDocs: vi.fn(async () => []),
}));
vi.mock("./semantic", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
  semanticSearch: vi.fn(),
}));
vi.mock("~/server/note-events", () => ({
  publishAppChange: vi.fn(),
  publishNoteChanges: vi.fn(),
}));

const { createNotesMcpServer } = await import("./tools");
const { FEEDBACK_PATH } = await import("./feedback-tools");

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
  clientName: "Claude",
};

describe.skipIf(!enabled)("feedback_submit (database)", () => {
  db.current = enabled
    ? new PrismaClient({ datasources: { db: { url } } })
    : null;
  const prisma = () => db.current!;
  const docIds: string[] = [];

  afterAll(async () => {
    if (!db.current) return;
    await prisma().taskItem.deleteMany({ where: { sourceDocId: { in: docIds } } });
    await prisma().doc.deleteMany({ where: { id: { in: docIds } } });
    await prisma().$disconnect();
  });

  it("files the report as a note with an open triage task", async () => {
    const server = createNotesMcpServer(ctx);
    const client = new Client({ name: "feedback-test", version: "1.0.0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);

    const summary = `notes_edit_blocks drops rows ${Date.now()}`;
    const result = await client.callTool({
      name: "feedback_submit",
      arguments: {
        kind: "bug",
        summary,
        tool: "notes_edit_blocks",
        happened: "Edited one table row; the other rows were gone.",
        proposedFix: "Keep rows the edit does not name.",
      },
    });
    expect(result.isError).toBeFalsy();
    const saved = result.structuredContent as { id: string; path: string };
    docIds.push(saved.id);
    expect(saved.path).toBe(FEEDBACK_PATH);

    const doc = await prisma().doc.findUniqueOrThrow({
      where: { id: saved.id },
      select: { markdown: true },
    });
    expect(doc.markdown).toContain("Keep rows the edit does not name.");
    expect(doc.markdown).toContain("**From:** Claude");

    const tasks = await prisma().taskItem.findMany({
      where: { sourceDocId: saved.id },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toContain(summary);
    expect(tasks[0].status).toBe("waiting");
  });
});
