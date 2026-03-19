import { seededPositionFor } from "~/layout/seeded";
import type { ArchiveMetaRecord, ArchivedPageCanvasCardMode } from "./archive.types";

export const ARCHIVE_CANVAS_SPREAD = 900;
export const ARCHIVE_CANVAS_IMAGE_LIMIT = 4;

function getMetaString(meta: ArchiveMetaRecord | null | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getArchiveMetaDescription(meta: ArchiveMetaRecord | null | undefined) {
  return (
    getMetaString(meta, "description") ||
    getMetaString(meta, "ogDescription") ||
    getMetaString(meta, "twitterDescription")
  );
}

export function getArchiveMetaPreviewImage(meta: ArchiveMetaRecord | null | undefined) {
  return (
    getMetaString(meta, "twitterImage") ||
    getMetaString(meta, "ogImage")
  );
}

export function buildArchivePreferredImages(args: {
  noteImageUrls: string[][];
  meta: ArchiveMetaRecord | null | undefined;
  limit?: number;
}) {
  const results: string[] = [];
  const seen = new Set<string>();
  const limit = Math.max(1, args.limit ?? ARCHIVE_CANVAS_IMAGE_LIMIT);

  const push = (value: string | null | undefined) => {
    if (!value) return;
    const next = value.trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    results.push(next);
  };

  for (const imageUrls of args.noteImageUrls) {
    for (const url of imageUrls) {
      push(url);
      if (results.length >= limit) return results;
    }
  }

  push(getArchiveMetaPreviewImage(args.meta));
  return results.slice(0, limit);
}

export function getArchiveCanvasDescription(args: {
  meta: ArchiveMetaRecord | null | undefined;
  noteText: string | null | undefined;
}) {
  const metaDescription = getArchiveMetaDescription(args.meta);
  if (metaDescription) return metaDescription;
  const noteText = args.noteText?.trim();
  return noteText ? noteText : null;
}

export function getArchiveCanvasPosition(args: {
  id: string;
  title: string;
  index: number;
  canvasX: number | null;
  canvasY: number | null;
}) {
  if (typeof args.canvasX === "number" && typeof args.canvasY === "number") {
    return { x: args.canvasX, y: args.canvasY };
  }

  return seededPositionFor(`${args.id}:${args.title}`, args.index, ARCHIVE_CANVAS_SPREAD);
}

export function normalizeArchiveCanvasCardMode(
  value: string | null | undefined,
): ArchivedPageCanvasCardMode {
  if (value === "compact" || value === "rich") return value;
  return "summary";
}
