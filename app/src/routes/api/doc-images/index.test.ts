import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "./index";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vn-doc-images-"));
  process.env.DOC_IMAGE_STORAGE_DIR = dir;
});
afterAll(async () => {
  delete process.env.DOC_IMAGE_STORAGE_DIR;
  await rm(dir, { recursive: true, force: true });
});

const post = (body: BodyInit, type: string) =>
  POST({
    request: new Request("http://app.test/api/doc-images", {
      method: "POST",
      body,
      headers: { "content-type": type },
    }),
  } as never);

describe("POST /api/doc-images", () => {
  it("stores pasted bytes by content hash", async () => {
    const response = await post(new Uint8Array(PNG), "image/png");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ mime: "image/png", bytes: PNG.length });
    expect(body.src).toMatch(/^\/api\/doc-images\/[a-f0-9]{64}\.png$/);
    expect(await readdir(dir)).toContain(path.basename(body.src));
  });

  it("sniffs the bytes rather than trusting the declared type", async () => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>";
    const response = await post(svg, "image/png");
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/not a PNG/);
  });

  it("refuses to fetch urls on the app's own network", async () => {
    const response = await post(
      JSON.stringify({ url: "http://127.0.0.1/secret.png" }),
      "application/json",
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/not a public address/);
  });

  it("needs a url in JSON requests", async () => {
    const response = await post("{}", "application/json");
    expect(response.status).toBe(400);
  });
});
