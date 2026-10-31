import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { randomUUID, timingSafeEqual } from "crypto";
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
import { recordMcpCall } from "./call-log";
import type { ConnectorContext } from "./shared";
import { scopeForAnnotations } from "./tool-registry";
import { createNotesMcpServer } from "./tools";

type Caller = { actorId: string; scopes: string[]; clientName: string | null };
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
      caller: {
        actorId: "chatgpt:dev-token",
        scopes: [...SCOPES],
        clientName: "Dev token",
      },
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
    caller: {
      actorId: check.grant.actorId,
      scopes: check.grant.scopes,
      clientName: check.grant.clientName,
    },
  };
}

type JsonRpcMessage = {
  result?: { tools?: { annotations?: { readOnlyHint?: boolean } }[] };
};

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
      Object.assign(tool, {
        securitySchemes: [
          { type: "oauth2", scopes: [scopeForAnnotations(tool.annotations)] },
        ],
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

type ToolCallBody = {
  method?: string;
  params?: { name?: string; arguments?: unknown };
};

/**
 * The SDK checks arguments against the schema before a tool's callback runs,
 * so the registrar never sees these calls. Without this record, a client
 * sending the wrong shape looks the same as a client that never called.
 */
async function recordInvalidArguments(
  ctx: ConnectorContext,
  body: ToolCallBody | null,
  response: Response,
): Promise<void> {
  if (body?.method !== "tools/call" || !body.params?.name) return;
  const reply = await response
    .clone()
    .json()
    .catch(() => null);
  const text: unknown = reply?.result?.content?.[0]?.text;
  if (!reply?.result?.isError || typeof text !== "string") return;
  if (!text.includes("Input validation error")) return;
  await recordMcpCall({
    ctx,
    callId: randomUUID(),
    tool: body.params.name,
    outcome: "refused",
    durationMs: 0,
    args: body.params.arguments,
    code: "invalid",
    message: text.replace(/^.*Invalid arguments for tool \S+: /, ""),
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

  const ctx: ConnectorContext = {
    origin: resolvePublicOrigin(request),
    actorId: auth.caller.actorId,
    scopes: auth.caller.scopes,
    clientName: auth.caller.clientName,
    scopeChallenge: wwwAuthenticateHeader(
      request,
      "insufficient_scope",
      "Reconnect Visual Notes to grant write access",
    ),
  };
  const server = createNotesMcpServer(ctx);
  const body: ToolCallBody | null = await request
    .clone()
    .json()
    .catch(() => null);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await withSecuritySchemes(
      await transport.handleRequest(request),
    );
    await recordInvalidArguments(ctx, body, response);
    return response;
  } finally {
    void server.close();
  }
}
