import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  doc: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  docRevision: { create: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
  logActionEvent: vi.fn(),
}));

vi.mock("~/server/db", () => ({ prisma: db }));
vi.mock("~/server/events/action-events", () => ({
  logActionEvent: db.logActionEvent,
}));

import { appendToNote, createNote, updateNote } from "./notes-write";
import { ConnectorError } from "./notes-shared";

const ctx = { origin: "https://notes.test", actorId: "chatgpt:test" };

const chatgptNote = {
  id: "n1",
  title: "Plan",
  path: "work.plan",
  html: "<p>v1</p>",
  markdown: "v1",
  originalSource: "chatgpt",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
    Promise.all(ops),
  );
  db.docRevision.create.mockResolvedValue({});
  db.docRevision.count.mockResolvedValue(1);
  db.doc.update.mockResolvedValue({
    id: "n1",
    title: "Plan",
    path: "work.plan",
  });
});

describe("createNote", () => {
  it("creates a ChatGPT-owned note and reports a new path", async () => {
    db.doc.findUnique.mockResolvedValue(null);
    db.doc.findFirst.mockResolvedValue(null);
    db.doc.create.mockResolvedValue({
      id: "n2",
      title: "Idea",
      path: "ideas.new",
    });

    const result = await createNote(ctx, {
      title: " Idea ",
      path: "ideas. new",
      markdown: "# Idea",
      idempotencyKey: "k1",
    });

    expect(db.doc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Idea",
          path: "ideas.new",
          originalSource: "chatgpt",
          originalContentId: "k1",
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "n2",
      pathIsNew: true,
      deduplicated: false,
      url: "https://notes.test/docs/n2",
    });
    expect(db.logActionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "doc.create",
        context: { actorId: "chatgpt:test", actorType: "chatgpt" },
      }),
    );
  });

  it("returns the first note when the idempotency key repeats", async () => {
    db.doc.findUnique.mockResolvedValue({
      id: "n2",
      title: "Idea",
      path: "ideas",
    });
    const result = await createNote(ctx, {
      title: "Again",
      markdown: "x",
      idempotencyKey: "k1",
    });
    expect(result).toMatchObject({ id: "n2", deduplicated: true });
    expect(db.doc.create).not.toHaveBeenCalled();
  });
});

describe("updateNote", () => {
  it("refuses notes the user wrote", async () => {
    db.doc.findUnique.mockResolvedValue({
      ...chatgptNote,
      originalSource: null,
    });
    await expect(
      updateNote(ctx, { id: "n1", title: "x" }),
    ).rejects.toMatchObject({ code: "not_owner" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses missing notes and empty updates", async () => {
    db.doc.findUnique.mockResolvedValue(null);
    await expect(
      updateNote(ctx, { id: "zz", title: "x" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(updateNote(ctx, { id: "n1" })).rejects.toBeInstanceOf(
      ConnectorError,
    );
  });

  it("snapshots the previous content before writing the new one", async () => {
    db.doc.findUnique.mockResolvedValue(chatgptNote);
    db.docRevision.count.mockResolvedValue(1);

    const result = await updateNote(ctx, { id: "n1", markdown: "# v2" });

    const [ops] = db.$transaction.mock.calls[0];
    expect(ops).toHaveLength(2);
    expect(db.docRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        docId: "n1",
        html: "<p>v1</p>",
        markdown: "v1",
        reason: "chatgpt.update",
      }),
    });
    expect(db.doc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ markdown: "# v2" }),
      }),
    );
    expect(result.version).toBe(2);
  });
});

describe("appendToNote", () => {
  it("keeps existing HTML and records an append revision", async () => {
    db.doc.findUnique.mockResolvedValue(chatgptNote);
    await appendToNote(ctx, { id: "n1", markdown: "more" });
    const data = db.doc.update.mock.calls[0][0].data;
    expect(data.html.startsWith("<p>v1</p>")).toBe(true);
    expect(db.docRevision.create.mock.calls[0][0].data.reason).toBe(
      "chatgpt.append",
    );
  });
});
