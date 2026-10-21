import type { APIRequestContext } from "@playwright/test";

// Calls a connector tool on /mcp with the local dev token. Specs that use it
// skip unless MCP_DEV_TOKEN is set (the audit harness forwards it when the
// launching shell sets MCP_CONNECTOR_ENABLED=true and MCP_DEV_TOKEN).

export const mcpToken = () => process.env.MCP_DEV_TOKEN;

export const callMcpTool = async <T = any>(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<T> => {
  const response = await request.post("/mcp", {
    headers: {
      authorization: `Bearer ${mcpToken()}`,
      accept: "application/json, text/event-stream",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  if (!response.ok())
    throw new Error(`[e2e-mcp] ${name} HTTP ${response.status()}`);
  const body = (await response.json()) as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  const text = body.result.content[0].text;
  if (body.result.isError)
    throw new Error(`[e2e-mcp] ${name} refused: ${text}`);
  return JSON.parse(text) as T;
};
