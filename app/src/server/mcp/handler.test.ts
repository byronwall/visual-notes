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

import { handleMcpRequest } from "./handler";

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
  it("is invisible when the connector flag is off", async () => {
    env.serverEnv.MCP_CONNECTOR_ENABLED = undefined;
    expect((await handleMcpRequest(post())).status).toBe(404);
  });

  it("rejects missing and wrong bearer tokens", async () => {
    expect((await handleMcpRequest(post())).status).toBe(401);
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
});
