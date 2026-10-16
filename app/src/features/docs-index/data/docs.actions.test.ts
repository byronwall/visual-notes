import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "~/server/db";
import { bulkSetSource } from "./docs.actions";

vi.mock("@solidjs/router", () => ({ action: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({
  prisma: { doc: { updateMany: vi.fn() } },
}));
vi.mock("~/server/events/action-events", () => ({
  logActionEvent: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

describe("bulkSetSource", () => {
  it("rejects blank labels and trims valid labels before writing", async () => {
    vi.mocked(prisma.doc.updateMany).mockResolvedValue({ count: 2 });

    await expect(bulkSetSource(" \t ")).rejects.toThrow();
    expect(prisma.doc.updateMany).not.toHaveBeenCalled();

    await bulkSetSource("  importer  ");
    expect(prisma.doc.updateMany).toHaveBeenCalledOnce();
    expect(prisma.doc.updateMany).toHaveBeenCalledWith({
      data: { originalSource: "importer" },
    });
  });
});
