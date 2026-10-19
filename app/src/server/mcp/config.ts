import { serverEnv } from "~/env/server";

export function isMcpConnectorEnabled(): boolean {
  return serverEnv.MCP_CONNECTOR_ENABLED?.trim().toLowerCase() === "true";
}

/** Static bearer for local MCP Inspector runs. Never honored in production. */
export function getMcpDevToken(): string | null {
  if (serverEnv.NODE_ENV === "production") return null;
  return serverEnv.MCP_DEV_TOKEN?.trim() || null;
}

/** Public origin used in tool results and OAuth metadata. */
export function resolvePublicOrigin(request: Request): string {
  const configured = serverEnv.PUBLIC_BASE_URL || serverEnv.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  return `${proto}://${host}`;
}

export function mcpNotFoundResponse(): Response {
  return new Response("Not found", { status: 404 });
}
