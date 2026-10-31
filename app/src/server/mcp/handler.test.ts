import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: {
    NODE_ENV: "development",
    MCP_CONNECTOR_ENABLED: "true" as string | undefined,
    MCP_DEV_TOKEN: "dev-token" as string | undefined,
  },
}));
vi.mock("~/env/server", () => env);
vi.mock("./tools", () => ({ createNotesMcpServer: vi.fn() }));
vi.mock("./call-log", () => ({ recordMcpCall: vi.fn() }));
vi.mock("~/server/db", () => ({
  prisma: { oAuthGrant: { findUnique: vi.fn() } },
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { recordMcpCall } from "./call-log";
import { handleMcpRequest } from "./handler";
import { createNotesMcpServer } from "./tools";

function post(headers: Record<string, string> = {}): Request {
  return new Request("http://notes.test/mcp", {
    method: "POST",
    headers,
    body: "{}",
  });
}

afterEach(() => {
  env.serverEnv.NODE_ENV = "development";
  env.serverEnv.MCP_CONNECTOR_ENABLED = "true";
});

describe("handleMcpRequest", () => {
  it("warns once, without recursing, when enabled without a token secret", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleMcpRequest(post());
    await handleMcpRequest(post());
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("is invisible when the connector flag is off", async () => {
    env.serverEnv.MCP_CONNECTOR_ENABLED = undefined;
    expect((await handleMcpRequest(post())).status).toBe(404);
  });

  it("rejects missing and wrong bearer tokens with an OAuth challenge", async () => {
    const missing = await handleMcpRequest(post());
    expect(missing.status).toBe(401);
    expect(missing.headers.get("WWW-Authenticate")).toContain(
      'resource_metadata="http://notes.test/.well-known/oauth-protected-resource/mcp"',
    );
    expect(
      (await handleMcpRequest(post({ Authorization: "Bearer nope" }))).status,
    ).toBe(401);
  });

  it("ignores the dev token in production", async () => {
    env.serverEnv.NODE_ENV = "production";
    expect(
      (await handleMcpRequest(post({ Authorization: "Bearer dev-token" })))
        .status,
    ).toBe(401);
  });

  it("only accepts POST in stateless mode", async () => {
    const response = await handleMcpRequest(
      new Request("http://notes.test/mcp"),
    );
    expect(response.status).toBe(405);
  });

  it("records a tool call the SDK refuses before the tool runs", async () => {
    const server = new McpServer({ name: "test", version: "1" });
    server.registerTool(
      "notes_attach_file",
      { inputSchema: { files: z.array(z.object({})) } },
      async () => ({ content: [] }),
    );
    vi.mocked(createNotesMcpServer).mockReturnValueOnce(server);

    const response = await handleMcpRequest(
      new Request("http://notes.test/mcp", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-token",
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "notes_attach_file",
            arguments: { files: ["chat_upload://image_0"] },
          },
        }),
      }),
    );

    expect((await response.json()).result.isError).toBe(true);
    expect(recordMcpCall).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "notes_attach_file",
        outcome: "refused",
        code: "invalid",
        args: { files: ["chat_upload://image_0"] },
        message: "Expected object, received string at files[0]",
      }),
    );
  });
});
