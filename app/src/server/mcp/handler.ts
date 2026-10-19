import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { timingSafeEqual } from "crypto";
import {
  getMcpDevToken,
  isMcpConnectorEnabled,
  mcpNotFoundResponse,
  resolvePublicOrigin,
} from "./config";
import { createNotesMcpServer } from "./tools";

type AuthResult =
  | { ok: true; actorId: string }
  | { ok: false; response: Response };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(request: Request): Promise<AuthResult> {
  const token = bearerToken(request);
  const devToken = getMcpDevToken();
  if (token && devToken && safeEqual(token, devToken)) {
    return { ok: true, actorId: "chatgpt:dev-token" };
  }
  return { ok: false, response: unauthorized() };
}

/**
 * Stateless Streamable HTTP: every POST builds a fresh server + transport,
 * so no session state lives in the app process.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isMcpConnectorEnabled()) return mcpNotFoundResponse();
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const server = createNotesMcpServer({
    origin: resolvePublicOrigin(request),
    actorId: auth.actorId,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}
