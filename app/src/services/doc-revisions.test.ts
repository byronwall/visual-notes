import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  doc: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  docRevision: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  docBlock: { deleteMany: vi.fn(), createMany: vi.fn() },
  docLink: { deleteMany: vi.fn(), createMany: vi.fn() },
  taskItem: {
    findMany: vi.fn(async () => []),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
  // writeNoteContent locks and re-reads the row.
  $queryRaw: vi.fn(),
  logActionEvent: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  query: (fn: unknown) => Object.assign(fn as object, { keyFor: () => "k" }),
  action: (fn: unknown) => fn,
  json: (value: unknown) => value,
}));
vi.mock("~/server/db", () => ({ prisma: db }));
vi.mock("~/server/events/action-events", () => ({
  logActionEvent: db.logActionEvent,
}));
vi.mock("./docs.queries", () => ({ fetchDoc: { keyFor: () => "doc" } }));

import { fetchDocRevisions, restoreDocRevision } from "./doc-revisions";

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof db) => Promise<unknown>)(db)
      : Promise.all(arg as Promise<unknown>[]),
  );
  db.docRevision.create.mockResolvedValue({});
  db.doc.update.mockResolvedValue({});
});

describe("restoreDocRevision", () => {
  it("snapshots the current content, then writes the old version back", async () => {
    db.docRevision.findUnique.mockResolvedValue({
      id: "r1",
      docId: "d1",
      title: "Old",
      path: "work.old",
      markdown: "old",
      html: "<p>old</p>",
    });
    const current = {
      title: "New",
      path: "work.new",
      markdown: "new",
      html: "<p>new</p>",
    };
    db.doc.findUnique.mockResolvedValue(current);
    db.$queryRaw.mockResolvedValue([
      { ...current, contentVersion: 3, content: null },
    ]);

    await restoreDocRevision("r1");

    expect(db.docRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        docId: "d1",
        title: "New",
        html: "<p>new</p>",
        reason: "restore",
        actorType: "magic_user",
      }),
    });
    const update = db.doc.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "d1" });
    expect(update.data).toMatchObject({
      title: "Old",
      path: "work.old",
      markdown: "old",
      contentVersion: { increment: 1 },
    });
    expect(update.data.content.content[0].content[0].text).toBe("old");
  });

  it("fails cleanly for an unknown version", async () => {
    db.docRevision.findUnique.mockResolvedValue(null);
    await expect(restoreDocRevision("missing")).rejects.toThrow(
      "Version not found",
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("fetchDocRevisions", () => {
  it("reports ChatGPT origin and serializes dates", async () => {
    db.doc.findUnique.mockResolvedValue({ originalSource: "chatgpt" });
    db.docRevision.findMany.mockResolvedValue([
      {
        id: "r1",
        createdAt: new Date("2026-10-18T00:00:00Z"),
        reason: "chatgpt.update",
        actorType: "chatgpt",
        title: "t",
        path: null,
      },
    ]);
    const info = await fetchDocRevisions("d1");
    expect(info.savedByChatGpt).toBe(true);
    expect(info.revisions[0].createdAt).toBe("2026-10-18T00:00:00.000Z");
  });
});
