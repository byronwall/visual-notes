import { prisma } from "~/server/db";
import { randomToken } from "./crypto";
import { jsonResponse, oauthError } from "./metadata";

const MAX_REDIRECT_URIS = 10;

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

/**
 * HTTPS anywhere, and plain HTTP to loopback for native apps such as Claude
 * Code (RFC 8252 section 7.3): the code never leaves the user's machine.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLoopbackHost(url.hostname);
}

function loopbackWithoutPort(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" || !isLoopbackHost(url.hostname)) return null;
    url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Exact match, except a loopback redirect may use any port, since native apps
 * pick a free one each time they sign in (RFC 8252 section 7.3).
 */
export function isRegisteredRedirectUri(
  registered: string[],
  requested: string,
): boolean {
  if (registered.includes(requested)) return true;
  const loose = loopbackWithoutPort(requested);
  return (
    loose !== null &&
    registered.some((uri) => loopbackWithoutPort(uri) === loose)
  );
}

/** RFC 7591 dynamic client registration for public (PKCE) clients. */
export async function handleClientRegistration(
  request: Request,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON");
  }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string")
    : [];
  if (!redirectUris.length || redirectUris.length > MAX_REDIRECT_URIS) {
    return oauthError("invalid_redirect_uri", "redirect_uris is required");
  }
  const rejected = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
  if (rejected) {
    return oauthError(
      "invalid_redirect_uri",
      `Redirect URI not allowed: ${rejected}`,
    );
  }
  const authMethod = body.token_endpoint_auth_method ?? "none";
  if (authMethod !== "none") {
    return oauthError(
      "invalid_client_metadata",
      "Only public clients (token_endpoint_auth_method=none) are supported",
    );
  }
  const clientName =
    typeof body.client_name === "string"
      ? body.client_name.slice(0, 120)
      : null;

  const client = await prisma.oAuthClient.create({
    data: { id: `vn_${randomToken(18)}`, clientName, redirectUris },
  });
  console.info(
    `[oauth] registered client ${client.id} (${clientName ?? "unnamed"})`,
  );
  return jsonResponse(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}
