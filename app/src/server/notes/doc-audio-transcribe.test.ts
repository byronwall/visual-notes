import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "~/server/db";
import { audioFileSize } from "./doc-audio-storage";
import { queueTranscription } from "./doc-audio-transcribe";

vi.mock("~/server/db", () => ({
  prisma: { docAudio: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("~/server/lib/ai", () => ({ callLLM: vi.fn() }));
vi.mock("./embedding-refresh", () => ({ scheduleEmbeddingRefresh: vi.fn() }));
vi.mock("./doc-audio-storage", () => ({
  audioFileSize: vi.fn(),
  resolveDocAudioStorageDir: () => "/tmp",
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("queueTranscription", () => {
  it("keeps the queue running when a recording is deleted mid-job", async () => {
    vi.stubEnv("GROQ_API_KEY", "test");
    vi.mocked(prisma.docAudio.findUnique).mockResolvedValue({
      id: "a",
      docId: "d",
      fileName: "a.m4a",
    } as never);
    // The file and the row are both gone once the job reaches them.
    vi.mocked(prisma.docAudio.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(audioFileSize).mockRejectedValue(new Error("ENOENT"));

    queueTranscription("deleted");
    queueTranscription("next");

    await vi.waitFor(() =>
      expect(prisma.docAudio.findUnique).toHaveBeenCalledWith({
        where: { id: "next" },
      }),
    );
  });
});
