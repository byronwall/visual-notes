import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function resolveArchiveHtmlStorageDir(): string {
  const fromEnv = process.env.ARCHIVE_HTML_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "page-html");
}

export async function persistArchiveHtml(html: string): Promise<{
  htmlHash: string;
  htmlPath: string;
}> {
  const normalized = String(html || "");
  const htmlHash = sha256Hex(normalized);
  const storageDir = resolveArchiveHtmlStorageDir();
  const filename = `${htmlHash}.html`;
  const absPath = path.join(storageDir, filename);

  await mkdir(storageDir, { recursive: true });
  if (!existsSync(absPath)) {
    await writeFile(absPath, normalized, "utf8");
  }

  return {
    htmlHash,
    htmlPath: path.posix.join("page-html", filename),
  };
}

export function buildArchiveHtmlSnippet(html: string, maxLength = 280): string {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain.length) return "No preview available.";
  return plain.slice(0, maxLength);
}

