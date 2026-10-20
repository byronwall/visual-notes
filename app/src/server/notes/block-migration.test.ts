import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  convert: vi.fn(),
}));
vi.mock("~/server/db", () => ({
  prisma: {
    doc: { findMany: mocks.findMany, count: mocks.count },
    $transaction: mocks.transaction,
  },
}));
vi.mock("~/lib/note-content/convert", () => ({
  contentFromLegacy: mocks.convert,
  toPlainText: () => "Example",
}));
vi.mock("./note-index", () => ({ rebuildNoteIndex: vi.fn() }));
vi.mock("./note-store", () => ({ contentColumns: vi.fn() }));

import { runBlockMigrationBatch } from "./block-migration";

describe("block migration workload", () => {
  it("caps legacy callers' batches and lets pending work run between notes", async () => {
    let conversions = 0;
    let lastYield = -1;
    const yieldPoints: number[] = [];
    const tick = () => {
      lastYield = conversions;
    };
    setImmediate(tick);
    mocks.convert.mockImplementation(() => {
      yieldPoints.push(lastYield);
      conversions++;
      setImmediate(tick);
      return { type: "doc" };
    });
    mocks.findMany.mockImplementation(async ({ take }) =>
      Array.from({ length: take }, (_, i) => ({
        id: `doc${i}`,
        title: "Example",
        html: "<p>Example</p>",
        markdown: "Example",
      })),
    );
    mocks.count.mockResolvedValue(50);
    const result = await runBlockMigrationBatch({ dryRun: true, limit: 200 });
    expect(result.processed).toBe(25);
    expect(result.nextCursor).toBe("doc24");
    expect(yieldPoints).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
