import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ prisma: {} }));

const { storeInlineImages, uploadImage } = await import("./note-images");
const { ConnectorError } = await import("./shared");
type ConnectorError = InstanceType<typeof ConnectorError>;

const ctx = {
  origin: "https://notes.test",
  actorId: "chatgpt:test",
  scopes: ["notes:read", "notes:write"],
  scopeChallenge: "",
};

// A 1x1 PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const SRC = /^\/api\/doc-images\/[a-f0-9]{64}\.png$/;

let storageDir: string;
const previousDir = process.env.DOC_IMAGE_STORAGE_DIR;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "vn-mcp-images-"));
  process.env.DOC_IMAGE_STORAGE_DIR = storageDir;
});

afterAll(async () => {
  process.env.DOC_IMAGE_STORAGE_DIR = previousDir;
  await rm(storageDir, { recursive: true, force: true });
});

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a refusal");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ConnectorError);
      return (error as ConnectorError).message;
    },
  );

describe("uploadImage", () => {
  it("stores base64 bytes by content hash and returns embeddable markdown", async () => {
    const first = await uploadImage(ctx, { data: PNG_BASE64, alt: "a [dot]" });
    expect(first.src).toMatch(SRC);
    expect(first.url).toBe(`https://notes.test${first.src}`);
    expect(first.markdown).toBe(`![a \\[dot\\]](${first.src})`);
    expect(first).toMatchObject({
      mime: "image/png",
      bytes: 70,
      width: 1,
      height: 1,
    });

    const fileName = path.basename(first.src);
    const stored = await readFile(path.join(storageDir, fileName));
    expect(stored.equals(Buffer.from(PNG_BASE64, "base64"))).toBe(true);

    const again = await uploadImage(ctx, {
      data: `data:image/png;base64,${PNG_BASE64}`,
    });
    expect(again.src).toBe(first.src);
    expect(await readdir(storageDir)).toEqual([fileName]);
  });

  it("refuses a cut-off image and stores nothing", async () => {
    const before = await readdir(storageDir).catch(() => []);
    const cut = PNG_BASE64.slice(0, 60);
    expect(await refusal(uploadImage(ctx, { data: cut }))).toMatch(/cut off/);
    expect(await readdir(storageDir).catch(() => [])).toEqual(before);
  });

  it("refuses anything that is not a raster image", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ).toString("base64");
    expect(await refusal(uploadImage(ctx, { data: svg }))).toMatch(
      /not a PNG, JPEG/,
    );
    const text = Buffer.from("hello world").toString("base64");
    expect(await refusal(uploadImage(ctx, { data: text }))).toMatch(
      /not a PNG, JPEG/,
    );
    expect(await refusal(uploadImage(ctx, { data: "not base64!" }))).toMatch(
      /base64 or a data URL/,
    );
  });

  it("needs exactly one of data or url", async () => {
    expect(await refusal(uploadImage(ctx, {}))).toMatch(/exactly one/);
    expect(
      await refusal(
        uploadImage(ctx, { data: PNG_BASE64, url: "https://example.com/a.png" }),
      ),
    ).toMatch(/exactly one/);
  });

  it("will not download from the app's own network", async () => {
    const server = http.createServer((_req, res) =>
      res.end(Buffer.from(PNG_BASE64, "base64")),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      expect(
        await refusal(uploadImage(ctx, { url: `http://127.0.0.1:${port}/a.png` })),
      ).toMatch(/not a public address/);
      expect(
        await refusal(uploadImage(ctx, { url: `http://localhost:${port}/a.png` })),
      ).toMatch(/not a public address/);
      expect(
        await refusal(uploadImage(ctx, { url: "http://169.254.169.254/latest" })),
      ).toMatch(/not a public address/);
      expect(
        await refusal(uploadImage(ctx, { url: "file:///etc/passwd" })),
      ).toMatch(/Only http and https/);
    } finally {
      server.close();
    }
  });
});

describe("storeInlineImages", () => {
  it("swaps data:image sources for stored paths and leaves other images alone", async () => {
    const markdown = [
      "Intro",
      `![dot](data:image/png;base64,${PNG_BASE64})`,
      "![remote](https://example.com/cat.png)",
      `<img src="data:image/png;base64,${PNG_BASE64}">`,
    ].join("\n\n");
    const out = await storeInlineImages(markdown);
    expect(out).not.toContain("base64");
    const [, src] = out.match(/!\[dot]\(([^)]+)\)/)!;
    expect(src).toMatch(SRC);
    expect(out).toContain(`<img src="${src}">`);
    expect(out).toContain("![remote](https://example.com/cat.png)");
  });

  it("returns markdown without inline images unchanged", async () => {
    expect(await storeInlineImages("Just text")).toBe("Just text");
  });

  it("refuses an inline image that is not a raster image", async () => {
    const svg = Buffer.from("<svg></svg>").toString("base64");
    expect(
      await refusal(storeInlineImages(`![x](data:image/svg+xml;base64,${svg})`)),
    ).toMatch(/Inline image 1 is not a PNG/);
  });
});
