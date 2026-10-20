import { serverEnv } from "~/env/server";
import { resolvePublicOrigin } from "~/server/mcp/config";

export const SCOPES = ["notes:read", "notes:write"] as const;
export const DEFAULT_SCOPE = SCOPES.join(" ");
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;

export function issuerFor(request: Request): string {
  return resolvePublicOrigin(request);
}

/** Canonical resource identifier for the MCP endpoint (token audience). */
export function resourceFor(request: Request): string {
  return `${resolvePublicOrigin(request)}/mcp`;
}

export function resourceMetadataUrl(request: Request): string {
  return `${resolvePublicOrigin(request)}/.well-known/oauth-protected-resource/mcp`;
}

export function getTokenSecret(): string | null {
  return serverEnv.MCP_TOKEN_SECRET?.trim() || null;
}

/** RFC 9728 protected resource metadata. */
export function protectedResourceMetadata(request: Request) {
  return {
    resource: resourceFor(request),
    authorization_servers: [issuerFor(request)],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Visual Notes",
  };
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(request: Request) {
  const issuer = issuerFor(request);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    scopes_supported: [...SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    },
  });
}

export function oauthError(
  error: string,
  description: string,
  status = 400,
): Response {
  console.info(`[oauth] ${error}: ${description}`);
  return jsonResponse({ error, error_description: description }, status);
}
