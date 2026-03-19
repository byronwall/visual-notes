export function normalizeArchivedPageUrl(input: string): {
  normalizedUrl: string;
  originalUrl: string;
  hostname: string | null;
} {
  const rawOriginalUrl = String(input || "").trim();
  if (!rawOriginalUrl) {
    throw new Error("URL is required");
  }

  const url = new URL(rawOriginalUrl);
  const keysToDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (/^utm_/i.test(key)) keysToDelete.push(key);
  });
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  const originalUrl = url.toString();
  const normalizedUrl = url.toString();

  return {
    normalizedUrl,
    originalUrl,
    hostname: url.hostname || null,
  };
}
