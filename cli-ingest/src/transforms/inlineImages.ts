import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export function inlineRelativeImages(
  markdown: string,
  baseDir: string
): string {
  if (!markdown || !baseDir) return markdown;

  let inlinedCount = 0;
  const imageRegex =
    /!\[([^\]]*)\]\((\s*<?)([^)\s]+?)(>?)(\s+("[^"]*"|'[^']*'|\([^)]+\)))?\)/g;

  const replaced = markdown.replace(
    imageRegex,
    (
      full: string,
      alt: string,
      prefix: string,
      url: string,
      suffix: string,
      titlePart: string | undefined
    ) => {
      const trimmedUrl = url.trim();
      const lower = trimmedUrl.toLowerCase();
      const isAbsolute =
        lower.startsWith("http://") ||
        lower.startsWith("https://") ||
        lower.startsWith("data:") ||
        lower.startsWith("file:") ||
        lower.startsWith("blob:") ||
        trimmedUrl.startsWith("/");

      if (isAbsolute) return full;

      let fsPath = trimmedUrl;
      try {
        // Handle percent-encoded paths from Notion exports
        fsPath = decodeURIComponent(trimmedUrl);
      } catch (_) {
        // leave as-is if decode fails
      }

      const joined = join(baseDir, fsPath);
      try {
        const st = statSync(joined);
        if (!st.isFile()) return full;

        const buf = readFileSync(joined);
        const mime = guessMimeType(extname(joined));
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        inlinedCount++;
        return `![${alt}](${prefix}${dataUrl}${suffix}${titlePart ?? ""})`;
      } catch (_) {
        return full;
      }
    }
  );

  if (inlinedCount > 0) {
    console.log(
      `[inlineImages] inlined ${inlinedCount} image(s) from ${baseDir}`
    );
  }
  return replaced;
}

function guessMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".bmp":
      return "image/bmp";
    case ".tiff":
    case ".tif":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}
