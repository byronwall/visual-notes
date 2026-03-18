export function normalizeArchivedPageUrl(input: string): {
  normalizedUrl: string;
  originalUrl: string;
  hostname: string | null;
} {
  const originalUrl = String(input || "").trim();
  if (!originalUrl) {
    throw new Error("URL is required");
  }

  const url = new URL(originalUrl);
  url.hash = "";
  const normalizedUrl = url.toString();

  return {
    normalizedUrl,
    originalUrl,
    hostname: url.hostname || null,
  };
}

