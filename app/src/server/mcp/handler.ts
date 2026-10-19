import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { timingSafeEqual } from "crypto";
import {
  unauthorizedResponse,
  verifyBearerAccessToken,
  wwwAuthenticateHeader,
} from "~/server/oauth/access";
import { SCOPES } from "~/server/oauth/metadata";
import {
  getMcpDevToken,
  isMcpConnectorEnabled,
  mcpNotFoundResponse,
  resolvePublicOrigin,
} from "./config";
import { createNotesMcpServer, TOOL_SCOPES } from "./tools";

type Caller = { actorId: string; scopes: string[] };
type AuthResult =
  | { ok: true; caller: Caller }
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

async function authenticate(request: Request): Promise<AuthResult> {
  const token = bearerToken(request);
  const devToken = getMcpDevToken();
  if (token && devToken && safeEqual(token, devToken)) {
    return {
      ok: true,
      caller: { actorId: "chatgpt:dev-token", scopes: [...SCOPES] },
    };
  }
  const check = await verifyBearerAccessToken(request, token);
  if (!check.ok) {
    console.info(`[mcp] rejected token: ${check.description}`);
    return {
      ok: false,
      response: unauthorizedResponse(request, check.error, check.description),
    };
  }
  return {
    ok: true,
    caller: { actorId: check.grant.actorId, scopes: check.grant.scopes },
  };
}

type JsonRpcMessage = { result?: { tools?: { name: string }[] } };

/**
 * ChatGPT reads per-tool `securitySchemes` from tools/list, a field the MCP
 * SDK does not emit, so it is added to the JSON response here.
 */
async function withSecuritySchemes(response: Response): Promise<Response> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }
  const text = await response.text();
  let body: JsonRpcMessage | JsonRpcMessage[];
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(text, response);
  }
  const messages = Array.isArray(body) ? body : [body];
  for (const message of messages) {
    for (const tool of message.result?.tools ?? []) {
      const scope = TOOL_SCOPES[tool.name];
      Object.assign(tool, {
        securitySchemes: [{ type: "oauth2", scopes: scope ? [scope] : [] }],
      });
    }
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(body), {
    status: response.status,
    headers,
  });
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
    actorId: auth.caller.actorId,
    scopes: auth.caller.scopes,
    scopeChallenge: wwwAuthenticateHeader(
      request,
      "insufficient_scope",
      "Reconnect Visual Notes to grant write access",
    ),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await withSecuritySchemes(await transport.handleRequest(request));
  } finally {
    void server.close();
  }
}
