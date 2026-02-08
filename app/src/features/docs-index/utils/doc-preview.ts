const DEFAULT_UNTITLED = "Untitled";

export const normalizePreviewText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const stripMarkdown = (value: string) =>
  normalizePreviewText(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~>-]/g, " ")
  );

const stripHtml = (value: string) =>
  normalizePreviewText(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );

export const clipDocTitle = (title: string, maxLen = 32) => {
  const trimmed = title.trim();
  if (!trimmed) return DEFAULT_UNTITLED;
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 3))}...`;
};

export const buildDocPreviewText = (
  markdown?: string | null,
  html?: string | null,
  maxLen = 240
) => {
  const md = stripMarkdown(markdown || "");
  if (md.length > 0) return md.slice(0, maxLen);
  const plain = stripHtml(html || "");
  if (plain.length > 0) return plain.slice(0, maxLen);
  return "No preview available.";
};

export const countMetaKeys = (meta?: Record<string, unknown> | null) => {
  if (!meta || typeof meta !== "object") return 0;
  return Object.keys(meta).length;
};
