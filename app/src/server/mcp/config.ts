import { serverEnv } from "~/env/server";

export function isMcpConnectorEnabled(): boolean {
  const enabled =
    serverEnv.MCP_CONNECTOR_ENABLED?.trim().toLowerCase() === "true";
  if (enabled) warnOnIncompleteConnectorConfig();
  return enabled;
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

let warnedAboutConfig = false;

/** Logs once when the connector is on but cannot issue stable tokens. */
function warnOnIncompleteConnectorConfig(): void {
  if (warnedAboutConfig) return;
  warnedAboutConfig = true;
  if (!serverEnv.MCP_TOKEN_SECRET?.trim()) {
    console.warn(
      "[mcp] MCP_TOKEN_SECRET is not set; OAuth tokens cannot be issued",
    );
  }
  if (serverEnv.NODE_ENV === "production" && !serverEnv.PUBLIC_BASE_URL) {
    console.warn(
      "[mcp] PUBLIC_BASE_URL is not set; token issuer/audience fall back to forwarded headers",
    );
  }
}

export function mcpNotFoundResponse(): Response {
  return new Response("Not found", { status: 404 });
}
