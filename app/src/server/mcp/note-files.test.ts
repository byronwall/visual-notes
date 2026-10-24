import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { NoteNode } from "~/lib/note-content/types";

vi.mock("~/server/db", () => ({ prisma: {} }));
const fetchPublicFile = vi.hoisted(() => vi.fn());
vi.mock("~/server/lib/public-fetch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPublicFile,
}));

const { describeFileAttachments, openAiFileArg, storeFiles } = await import(
  "./note-files"
);
const { ConnectorError } = await import("./shared");

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

const PDF = Buffer.from("%PDF-1.7\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const FILE_SRC = /^\/api\/doc-files\/[a-f0-9]{64}\//;

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vn-mcp-files-"));
  process.env.DOC_FILE_STORAGE_DIR = path.join(dir, "files");
  process.env.DOC_IMAGE_STORAGE_DIR = path.join(dir, "images");
});
afterAll(async () => {
  delete process.env.DOC_FILE_STORAGE_DIR;
  delete process.env.DOC_IMAGE_STORAGE_DIR;
  await rm(dir, { recursive: true, force: true });
});
beforeEach(() => fetchPublicFile.mockReset());

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConnectorError);
  return (error as Error).message;
};

const fetched = (buffer: Buffer, extra: Record<string, string> = {}) => ({
  buffer,
  contentType: "application/octet-stream",
  contentDisposition: "",
  finalUrl: "https://files.oaiusercontent.com/file-abc",
  ...extra,
});

describe("openAiFileArg", () => {
  it("accepts what ChatGPT sends and nothing else", () => {
    expect(
      openAiFileArg.parse({ download_url: "https://x/y", file_id: "file_1" }),
    ).toEqual({
      download_url: "https://x/y",
      file_id: "file_1",
    });
    expect(() =>
      openAiFileArg.parse({ download_url: "https://x/y" }),
    ).toThrow();
    expect(() =>
      openAiFileArg.parse({ download_url: "u", file_id: "f", extra: 1 }),
    ).toThrow();
  });
});

describe("storeFiles", () => {
  it("downloads every file ChatGPT hands over, keeping their names", async () => {
    fetchPublicFile
      .mockResolvedValueOnce(fetched(PDF))
      .mockResolvedValueOnce(
        fetched(Buffer.from("a,b\n1,2\n"), {
          contentDisposition: 'attachment; filename="scores.csv"',
        }),
      );
    const files = await storeFiles(ctx, {
      files: [
        {
          download_url: "https://files.oaiusercontent.com/1",
          file_id: "file_1",
          file_name: "Board pack.pdf",
          mime_type: "application/pdf",
        },
        {
          download_url: "https://files.oaiusercontent.com/2",
          file_id: "file_2",
        },
      ],
    });
    expect(fetchPublicFile).toHaveBeenCalledWith(
      "https://files.oaiusercontent.com/1",
      expect.objectContaining({ accept: "*/*" }),
    );
    expect(files.map((f) => [f.name, f.display, f.mime])).toEqual([
      ["Board pack.pdf", "file", "application/pdf"],
      ["scores.csv", "file", "text/csv"],
    ]);
    expect(files[0]!.src).toMatch(FILE_SRC);
    expect(files[0]!.url).toBe(`https://notes.test${files[0]!.src}`);
    expect(files[0]!.markdown).toBe(`[Board pack.pdf](${files[0]!.src})`);
  });

  it("shows pictures inline unless asked to keep them as files", async () => {
    const [inline] = await storeFiles(ctx, {
      data: PNG.toString("base64"),
      name: "chart.png",
    });
    expect(inline).toMatchObject({ display: "image", mime: "image/png" });
    expect(inline!.markdown).toMatch(
      /^!\[chart]\(\/api\/doc-images\/[a-f0-9]{64}\.png\)$/,
    );

    const [card] = await storeFiles(ctx, {
      data: PNG.toString("base64"),
      name: "chart.png",
      display: "file",
    });
    expect(card).toMatchObject({ display: "file", name: "chart.png" });
    expect(card!.src).toMatch(FILE_SRC);
  });

  it("names base64 data from its bytes when no name is given", async () => {
    const [file] = await storeFiles(ctx, {
      data: `data:application/pdf;base64,${PDF.toString("base64")}`,
    });
    expect(file!.name).toBe("file.pdf");
  });

  it("needs exactly one source and turns fetch failures into refusals", async () => {
    expect(await refusal(storeFiles(ctx, {}))).toMatch(/exactly one/);
    expect(
      await refusal(
        storeFiles(ctx, { data: "AAAA", url: "https://example.com/a" }),
      ),
    ).toMatch(/exactly one/);
    const { PublicFetchError } = await import("~/server/lib/public-fetch");
    fetchPublicFile.mockRejectedValueOnce(
      new PublicFetchError("example.com answered 403"),
    );
    expect(
      await refusal(storeFiles(ctx, { url: "https://example.com/a.pdf" })),
    ).toMatch(/answered 403/);
  });
});

describe("describeFileAttachments", () => {
  it("fills in type and size for stored files and refuses unknown ones", async () => {
    const [file] = await storeFiles(ctx, {
      data: PDF.toString("base64"),
      name: "a.pdf",
    });
    const node: NoteNode = {
      type: "fileAttachment",
      attrs: { src: file!.src, name: "a.pdf" },
    };
    await describeFileAttachments([node]);
    expect(node.attrs).toMatchObject({
      mime: "application/pdf",
      size: PDF.length,
    });

    const missing: NoteNode = {
      type: "fileAttachment",
      attrs: { src: `/api/doc-files/${"0".repeat(64)}/x.pdf`, name: "x.pdf" },
    };
    expect(await refusal(describeFileAttachments([missing]))).toMatch(
      /not a stored file/,
    );
    // Already in the note: left alone.
    await expect(
      describeFileAttachments([missing], [missing]),
    ).resolves.toBeUndefined();
  });
});
