import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  docFileHeaders,
  FileRejectedError,
  fileNameFromDisposition,
  nameForFile,
  storedFileSize,
  storeFileBytes,
} from "./doc-file-store";
import {
  cleanFileName,
  parseDocFileSrc,
} from "~/services/doc-files/doc-files.shared";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n");

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "vn-doc-files-"));
  process.env.DOC_FILE_STORAGE_DIR = dir;
});
afterAll(async () => {
  delete process.env.DOC_FILE_STORAGE_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("storeFileBytes", () => {
  it("stores bytes once under their hash, named by the caller", async () => {
    const first = await storeFileBytes(PDF, { name: "Board pack.pdf" });
    expect(first).toMatchObject({
      name: "Board pack.pdf",
      mime: "application/pdf",
      bytes: PDF.length,
    });
    expect(first.src).toBe(`/api/doc-files/${first.hash}/Board%20pack.pdf`);
    expect(parseDocFileSrc(first.src)).toEqual({
      hash: first.hash,
      name: "Board pack.pdf",
    });

    const again = await storeFileBytes(PDF, { name: "copy.pdf" });
    expect(again.hash).toBe(first.hash);
    expect(await readdir(dir)).toEqual([first.hash]);
    expect((await readFile(path.join(dir, first.hash))).equals(PDF)).toBe(true);
    expect(await storedFileSize(first.hash)).toBe(PDF.length);
    expect(await storedFileSize("f".repeat(64))).toBeNull();
    expect(await storedFileSize("../etc/passwd")).toBeNull();
  });

  it("refuses empty files", async () => {
    await expect(storeFileBytes(Buffer.alloc(0))).rejects.toBeInstanceOf(
      FileRejectedError,
    );
  });
});

describe("naming", () => {
  it("adds an extension from the bytes or the declared type", () => {
    expect(nameForFile(PDF, undefined)).toBe("file.pdf");
    expect(
      nameForFile(Buffer.from("a,b\n1,2"), "data", "text/csv; charset=utf-8"),
    ).toBe("data.csv");
    expect(nameForFile(Buffer.from("??"), "notes")).toBe("notes");
    expect(nameForFile(PDF, "report.final")).toBe("report.final");
  });

  it("strips path parts and control characters, and keeps long names' extensions", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\Users\\me\\a\u0000b.txt")).toBe("ab.txt");
    expect(cleanFileName("...hidden")).toBe("hidden");
    expect(cleanFileName("   ")).toBe("file");
    const long = cleanFileName(`${"x".repeat(200)}.xlsx`);
    expect(long).toHaveLength(120);
    expect(long.endsWith(".xlsx")).toBe(true);
  });

  it("reads the name from Content-Disposition", () => {
    expect(fileNameFromDisposition(`attachment; filename="a b.pdf"`)).toBe(
      "a b.pdf",
    );
    expect(
      fileNameFromDisposition(
        `attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`,
      ),
    ).toBe("résumé.pdf");
    expect(fileNameFromDisposition("inline")).toBeNull();
  });
});

describe("docFileHeaders", () => {
  it("opens PDFs and media inline", () => {
    const pdf = docFileHeaders("a.pdf");
    expect(pdf["content-type"]).toBe("application/pdf");
    expect(pdf["content-disposition"]).toMatch(/^inline;/);
    expect(pdf["content-security-policy"]).toBeUndefined();
    expect(docFileHeaders("clip.mp4")["content-type"]).toBe("video/mp4");
  });

  it("shows text as plain text", () => {
    const csv = docFileHeaders("data.csv");
    expect(csv["content-type"]).toBe("text/plain; charset=utf-8");
    expect(csv["content-security-policy"]).toMatch(/sandbox/);
  });

  it("downloads anything that could run script, and Office files", () => {
    for (const name of [
      "page.html",
      "logo.svg",
      "feed.xml",
      "x.js",
      "deck.pptx",
      "noext",
    ]) {
      const headers = docFileHeaders(name);
      expect(headers["content-type"]).toBe("application/octet-stream");
      expect(headers["content-disposition"]).toMatch(/^attachment;/);
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["content-security-policy"]).toMatch(/sandbox/);
    }
  });

  it("forces a download on request and encodes non-ASCII names", () => {
    const headers = docFileHeaders("résumé.pdf", { download: true });
    expect(headers["content-disposition"]).toBe(
      `attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`,
    );
  });
});
