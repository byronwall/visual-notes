import type { APIEvent } from "@solidjs/start/server";
import {
  isMcpConnectorEnabled,
  mcpNotFoundResponse,
} from "~/server/mcp/config";
import {
  authorizationServerMetadata,
  jsonResponse,
  protectedResourceMetadata,
} from "./metadata";

type Handler = (request: Request) => Response | Promise<Response>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, mcp-protocol-version",
};

/** Flag-gated handler; browsers (e.g. the MCP Inspector) also get CORS. */
export function connectorRoute(handler: Handler) {
  return (event: APIEvent) => {
    if (!isMcpConnectorEnabled()) return mcpNotFoundResponse();
    return handler(event.request);
  };
}

export function corsPreflight() {
  return () => new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Serves RFC 9728 / RFC 8414 metadata, including the path-suffixed forms
 * (e.g. /.well-known/oauth-protected-resource/mcp). Called from middleware
 * because the file router does not serve dot-folders.
 */
export function handleWellKnown(request: Request): Response | null {
  const { pathname } = new URL(request.url);
  const isResource = pathname.startsWith(
    "/.well-known/oauth-protected-resource",
  );
  const isServer = pathname.startsWith(
    "/.well-known/oauth-authorization-server",
  );
  if (!isResource && !isServer) return null;
  if (!isMcpConnectorEnabled()) return mcpNotFoundResponse();
  if (request.method === "OPTIONS") return corsPreflight()();
  return jsonResponse(
    isResource
      ? protectedResourceMetadata(request)
      : authorizationServerMetadata(request),
  );
}
