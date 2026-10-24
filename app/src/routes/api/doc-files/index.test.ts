import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "./[hash]/[name]";
import { POST } from "./index";

const BODY = Buffer.from("name,score\nada,10\ngrace,12\n");

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vn-doc-files-route-"));
  process.env.DOC_FILE_STORAGE_DIR = dir;
});
afterAll(async () => {
  delete process.env.DOC_FILE_STORAGE_DIR;
  await rm(dir, { recursive: true, force: true });
});

const upload = (body: BodyInit, headers: Record<string, string>) =>
  POST({
    request: new Request("http://app.test/api/doc-files", {
      method: "POST",
      body,
      headers,
    }),
  } as never);

const get = (src: string, headers: Record<string, string> = {}) => {
  const [, , , hash, name] = src.split("?")[0]!.split("/");
  return GET({
    request: new Request(`http://app.test${src}`, { headers }),
    params: { hash, name },
  } as never);
};

describe("/api/doc-files", () => {
  it("stores an upload under its name and serves it back, with ranges", async () => {
    const response = await upload(new Uint8Array(BODY), {
      "content-type": "text/csv",
      "x-file-name": encodeURIComponent("Scores (final).csv"),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      name: "Scores (final).csv",
      mime: "text/csv",
      bytes: BODY.length,
    });
    expect(body.src).toMatch(
      /^\/api\/doc-files\/[a-f0-9]{64}\/Scores%20%28final%29\.csv$/,
    );

    const full = await get(body.src);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(Buffer.from(await full.arrayBuffer()).equals(BODY)).toBe(true);

    const part = await get(body.src, { range: "bytes=0-9" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-9/${BODY.length}`);
    expect(await part.text()).toBe("name,score");

    const download = await get(`${body.src}?download=1`);
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;/);

    const cached = await get(body.src, {
      "if-none-match": full.headers.get("etag")!,
    });
    expect(cached.status).toBe(304);
  });

  it("answers 404 for unknown or malformed paths", async () => {
    expect((await get(`/api/doc-files/${"0".repeat(64)}/x.pdf`)).status).toBe(
      404,
    );
    expect((await get("/api/doc-files/nothex/x.pdf")).status).toBe(404);
  });

  it("refuses empty uploads", async () => {
    const response = await upload(new Uint8Array(0), {
      "content-type": "application/pdf",
    });
    expect(response.status).toBe(422);
  });
});
