import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  doc: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
  docRevision: { create: vi.fn(), count: vi.fn() },
  docBlock: { deleteMany: vi.fn(), createMany: vi.fn() },
  docLink: { deleteMany: vi.fn(), createMany: vi.fn() },
  taskItem: {
    findMany: vi.fn(async () => []),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
  logActionEvent: vi.fn(),
}));

vi.mock("~/server/db", () => ({ prisma: db }));
vi.mock("~/server/notes/embedding-refresh", () => ({
  scheduleEmbeddingRefresh: vi.fn(),
}));
vi.mock("~/server/events/action-events", () => ({
  logActionEvent: db.logActionEvent,
}));

import {
  appendToNote,
  attachToNote,
  createNote,
  editNote,
  updateNote,
} from "./notes-write";
import { storeFileBytes } from "~/server/lib/doc-file-store";
import { ConnectorError } from "./shared";

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: 'Bearer error="insufficient_scope"',
};

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
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof db) => Promise<unknown>)(db)
      : Promise.all(arg as Promise<unknown>[]),
  );
  db.docRevision.create.mockResolvedValue({});
  db.docRevision.count.mockResolvedValue(1);
  db.$queryRaw.mockResolvedValue([{ ...chatgptNote, contentVersion: 1 }]);
  db.doc.findUniqueOrThrow.mockResolvedValue({
    id: "n1",
    title: "Plan",
    path: "work.plan",
  });
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
      appUrl: "https://notes.test/docs/n2",
    });
    expect(db.logActionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "doc.create",
        context: { actorId: "chatgpt:test", actorType: "chatgpt" },
      }),
    );
  });

  it("stores inline base64 images as files instead of in the body", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vn-notes-write-"));
    const previousDir = process.env.DOC_IMAGE_STORAGE_DIR;
    process.env.DOC_IMAGE_STORAGE_DIR = dir;
    try {
      db.doc.findUnique.mockResolvedValue(null);
      db.doc.create.mockResolvedValue({ id: "n3", title: "Pic", path: null });
      const png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

      await createNote(ctx, {
        title: "Pic",
        markdown: `![dot](data:image/png;base64,${png})`,
      });

      const { data } = db.doc.create.mock.calls[0][0];
      expect(JSON.stringify(data.content)).not.toContain("base64");
      expect(data.markdown).toMatch(
        /!\[dot]\(\/api\/doc-images\/[a-f0-9]{64}\.png\)/,
      );
    } finally {
      process.env.DOC_IMAGE_STORAGE_DIR = previousDir;
      await rm(dir, { recursive: true, force: true });
    }
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

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.docBlock.createMany).toHaveBeenCalledOnce();
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
  it("keeps existing blocks and records an append revision", async () => {
    db.doc.findUnique.mockResolvedValue(chatgptNote);
    await appendToNote(ctx, { id: "n1", markdown: "more" });
    const data = db.doc.update.mock.calls[0][0].data;
    const blocks = data.content.content;
    expect(blocks[0].content[0].text).toBe("v1");
    expect(blocks[1].content[0].text).toBe("more");
    expect(data.html.indexOf("v1")).toBeLessThan(data.html.indexOf("more"));
    expect(db.docRevision.create.mock.calls[0][0].data.reason).toBe(
      "chatgpt.append",
    );
  });
});

describe("editNote", () => {
  const blockNote = {
    ...chatgptNote,
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "keep0001" },
          content: [{ type: "text", text: "keep me" }],
        },
        {
          type: "paragraph",
          attrs: { id: "edit0001" },
          content: [{ type: "text", text: "old" }],
        },
      ],
    },
  };

  it("replaces one block and leaves the others identical", async () => {
    db.doc.findUnique.mockResolvedValue(blockNote);
    db.$queryRaw.mockResolvedValue([{ ...blockNote, contentVersion: 3 }]);
    await editNote(ctx, {
      id: "n1",
      edits: [{ op: "replace", blockId: "edit0001", markdown: "new **text**" }],
    });
    const blocks = db.doc.update.mock.calls[0][0].data.content.content;
    expect(blocks[0]).toEqual(blockNote.content.content[0]);
    expect(blocks[1].attrs.id).toBe("edit0001");
    expect(
      blocks[1].content.map((n: { text: string }) => n.text).join(""),
    ).toBe("new text");
    expect(db.docRevision.create.mock.calls[0][0].data.reason).toBe(
      "chatgpt.edit",
    );
  });

  it("reports unknown block ids with the valid ones", async () => {
    db.doc.findUnique.mockResolvedValue(blockNote);
    db.$queryRaw.mockResolvedValue([{ ...blockNote, contentVersion: 3 }]);
    await expect(
      editNote(ctx, { id: "n1", edits: [{ op: "delete", blockId: "ghost" }] }),
    ).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining("keep0001"),
    });
  });
});

describe("attachToNote", () => {
  const userNote = {
    id: "u1",
    title: "Trip",
    path: "personal.trip",
    originalSource: null,
    html: "",
    markdown: "",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { id: "first001" },
          content: [{ type: "text", text: "Itinerary" }],
        },
        {
          type: "paragraph",
          attrs: { id: "last0001" },
          content: [{ type: "text", text: "Packing" }],
        },
      ],
    },
  };

  const withStoredFile = async <T>(run: (src: string) => Promise<T>) => {
    const dir = await mkdtemp(path.join(tmpdir(), "vn-attach-"));
    const previousDir = process.env.DOC_FILE_STORAGE_DIR;
    process.env.DOC_FILE_STORAGE_DIR = dir;
    try {
      const stored = await storeFileBytes(Buffer.from("%PDF-1.7\n%%EOF"), {
        name: "tickets.pdf",
      });
      return await run(stored.src);
    } finally {
      process.env.DOC_FILE_STORAGE_DIR = previousDir;
      await rm(dir, { recursive: true, force: true });
    }
  };

  beforeEach(() => {
    db.doc.findUnique.mockResolvedValue(userNote);
    db.$queryRaw.mockResolvedValue([{ ...userNote, contentVersion: 2 }]);
  });

  it("adds a card to the user's own note after the chosen block", async () => {
    await withStoredFile(async (src) => {
      const result = await attachToNote(ctx, {
        id: "u1",
        markdown: [`[tickets.pdf](${src})`],
        afterBlockId: "first001",
      });
      const blocks = db.doc.update.mock.calls[0][0].data.content.content;
      expect(blocks.map((b: { type: string }) => b.type)).toEqual([
        "paragraph",
        "fileAttachment",
        "paragraph",
      ]);
      expect(blocks[1].attrs).toMatchObject({
        src,
        name: "tickets.pdf",
        mime: "application/pdf",
        size: 14,
      });
      expect(result.blockIds).toEqual([blocks[1].attrs.id]);
      expect(result.alreadyAttached).toEqual([]);
      expect(db.docRevision.create.mock.calls[0][0].data.reason).toBe(
        "chatgpt.attach",
      );
    });
  });

  it("does not attach the same file twice", async () => {
    await withStoredFile(async (src) => {
      const attached = {
        ...userNote,
        content: {
          type: "doc",
          content: [
            ...userNote.content.content,
            {
              type: "fileAttachment",
              attrs: { id: "file0001", src, name: "tickets.pdf" },
            },
          ],
        },
      };
      db.doc.findUnique.mockResolvedValue(attached);
      db.$queryRaw.mockResolvedValue([{ ...attached, contentVersion: 2 }]);
      const result = await attachToNote(ctx, {
        id: "u1",
        markdown: [`[tickets.pdf](${src})`],
      });
      expect(result.blockIds).toEqual(["file0001"]);
      expect(result.alreadyAttached).toEqual([src]);
      const blocks = db.doc.update.mock.calls[0]?.[0].data.content.content;
      expect(blocks ?? attached.content.content).toHaveLength(3);
    });
  });

  it("refuses an unknown afterBlockId", async () => {
    await withStoredFile(async (src) => {
      await expect(
        attachToNote(ctx, {
          id: "u1",
          markdown: [`[tickets.pdf](${src})`],
          afterBlockId: "ghost",
        }),
      ).rejects.toMatchObject({
        code: "invalid",
        message: expect.stringContaining("ghost"),
      });
    });
  });
});

describe("file links in agent markdown", () => {
  it("refuses an attachment line for a file that was never stored", async () => {
    db.doc.findUnique.mockResolvedValue(null);
    db.doc.findFirst.mockResolvedValue(null);
    await expect(
      createNote(ctx, {
        title: "Refs",
        markdown: `[ghost.pdf](/api/doc-files/${"0".repeat(64)}/ghost.pdf)`,
      }),
    ).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining("not a stored file"),
    });
    expect(db.doc.create).not.toHaveBeenCalled();
  });
});
