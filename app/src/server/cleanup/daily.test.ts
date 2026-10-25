import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));
vi.mock("./queue", () => ({ queueFor: vi.fn() }));
vi.mock("./regroup-queue", () => ({ regroupQueue: vi.fn() }));

import { interleave } from "./daily";
import type { QueueItem } from "./queue";

const item = (docId: string, bucket: string, confidence: number) =>
  ({ docId, bucket, confidence }) as QueueItem;

describe("interleave", () => {
  it("alternates buckets, strongest bucket first, without duplicates", () => {
    const out = interleave([
      [
        item("a1", "distill", 0.9),
        item("a2", "distill", 0.8),
        item("a3", "distill", 0.7),
      ],
      [item("b1", "delete", 0.95)],
      [],
      [item("c1", "regroup", 0.6), item("a1", "regroup", 0.6)],
    ]);
    expect(out.map((i) => i.docId)).toEqual(["b1", "a1", "c1", "a2", "a3"]);
  });
});
