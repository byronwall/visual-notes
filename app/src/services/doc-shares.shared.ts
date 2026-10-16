import type { DocShareSummary } from "./doc-shares.queries";

export const DEFAULT_SHARE_PREFIX = "/share";

const SHARE_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function normalizeShareSlug(value: string | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed;
}

export function isValidShareSlug(value: string): boolean {
  return SHARE_SLUG_PATTERN.test(value);
}

export function buildShareUrlPath(slug: string): string {
  return `${DEFAULT_SHARE_PREFIX}/${slug}`;
}

export function isDocShareUpsertAcknowledged(
  value: unknown,
): value is DocShareSummary {
  if (typeof value !== "object" || value === null) return false;

  const share = value as Record<string, unknown>;
  return (
    typeof share.id === "string" &&
    share.id.length > 0 &&
    typeof share.slug === "string" &&
    isValidShareSlug(share.slug) &&
    share.shareUrl === buildShareUrlPath(share.slug) &&
    typeof share.createdAt === "string" &&
    typeof share.updatedAt === "string"
  );
}

export function isDocShareDeleteAcknowledged(
  value: unknown,
  submittedDocId: string,
): boolean {
  if (typeof value !== "object" || value === null) return false;

  const result = value as Record<string, unknown>;
  return result.ok === true && result.docId === submittedDocId;
}

export function buildShareAbsoluteUrl(
  baseUrl: string,
  shareUrl: string,
): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${shareUrl.startsWith("/") ? "" : "/"}${shareUrl}`;
}
