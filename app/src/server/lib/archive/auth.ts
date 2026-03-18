import { serverEnv } from "~/env/server";

const ARCHIVE_AUTH_SCHEME = "Bearer";

export function isArchiveIngestAuthorized(request: Request): boolean {
  const expected = serverEnv.ARCHIVE_INGEST_TOKEN?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization")?.trim();
  if (!header) return false;

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme !== ARCHIVE_AUTH_SCHEME || !token) return false;
  return token === expected;
}

export function buildArchiveUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

