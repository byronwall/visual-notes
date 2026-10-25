import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  title: string;
  path: string | null;
  archivedAt: Date | null;
  archivedIntoId: string | null;
  archiveReason: string | null;
};

const store = vi.hoisted(() => ({
  docs: new Map<string, Row>(),
  tombstones: new Map<string, { id: string; redirectDocId: string | null }>(),
}));

vi.mock("~/server/events/action-events", () => ({ logActionEvent: vi.fn() }));
vi.mock("~/server/db", () => ({
  prisma: {
    doc: {
      findUnique: vi.fn(async ({ where }) => store.docs.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }) =>
        [...store.docs.values()].filter(
          (d) => d.archivedAt && d.archivedAt < where.archivedAt.lt,
        ),
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const d of store.docs.values()) {
          if (d.archivedIntoId === where.archivedIntoId) {
            Object.assign(d, data);
            count += 1;
          }
        }
        return { count };
      }),
      delete: vi.fn(async ({ where }) => store.docs.delete(where.id)),
    },
    docTombstone: {
      findUnique: vi.fn(
        async ({ where }) => store.tombstones.get(where.id) ?? null,
      ),
      upsert: vi.fn(async ({ create }) => {
        store.tombstones.set(create.id, create);
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        for (const t of store.tombstones.values()) {
          if (t.redirectDocId === where.redirectDocId) Object.assign(t, data);
        }
        return { count: 0 };
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { resolveArchiveRedirect } from "./archive-window";
import { purgeExpiredArchive } from "./note-archive";

const doc = (row: Partial<Row> & { id: string }): Row => ({
  title: row.id,
  path: null,
  archivedAt: null,
  archivedIntoId: null,
  archiveReason: null,
  ...row,
});

beforeEach(() => {
  store.docs.clear();
  store.tombstones.clear();
});

describe("resolveArchiveRedirect", () => {
  it("returns null for a live note", async () => {
    store.docs.set("a", doc({ id: "a" }));
    expect(await resolveArchiveRedirect("a")).toBeNull();
  });

  it("follows a chain of archived notes to the live one", async () => {
    const at = new Date();
    store.docs.set("a", doc({ id: "a", archivedAt: at, archivedIntoId: "b" }));
    store.docs.set("b", doc({ id: "b", archivedAt: at, archivedIntoId: "c" }));
    store.docs.set("c", doc({ id: "c", title: "Kept" }));
    expect(await resolveArchiveRedirect("a")).toEqual({
      id: "c",
      title: "Kept",
    });
  });

  it("follows a tombstone and stops at a dead end", async () => {
    store.tombstones.set("gone", { id: "gone", redirectDocId: "c" });
    store.docs.set("c", doc({ id: "c" }));
    expect(await resolveArchiveRedirect("gone")).toEqual({
      id: "c",
      title: "c",
    });
    expect(await resolveArchiveRedirect("never")).toBeNull();
  });
});

describe("purgeExpiredArchive", () => {
  it("deletes expired notes, keeps a tombstone, and re-points sources", async () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const old = new Date("2026-10-01T00:00:00Z");
    const recent = new Date("2026-11-25T00:00:00Z");
    store.docs.set(
      "mid",
      doc({ id: "mid", archivedAt: old, archivedIntoId: "final" }),
    );
    store.docs.set(
      "src",
      doc({ id: "src", archivedAt: recent, archivedIntoId: "mid" }),
    );
    store.docs.set("final", doc({ id: "final" }));

    expect(await purgeExpiredArchive(now)).toBe(1);
    expect(store.docs.has("mid")).toBe(false);
    expect(store.tombstones.get("mid")?.redirectDocId).toBe("final");
    expect(store.docs.get("src")?.archivedIntoId).toBe("final");
    expect(await resolveArchiveRedirect("mid")).toEqual({
      id: "final",
      title: "final",
    });
  });
});
