import { afterAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("AUTH_SECRET", "research-auth-test-secret");
vi.stubEnv("MAGIC_PASSWORD", "research-auth-test-password");
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("RESEARCH_AGENT_TOKEN", "agent-token-123");

const { isResearchAgentAuthorized, isResearchAgentPath } = await import("./auth");

afterAll(() => vi.unstubAllEnvs());

const request = (authorization?: string) =>
  new Request("http://notes.test/api/research/topics", {
    headers: authorization ? { authorization } : {},
  });

describe("research agent auth", () => {
  it("accepts only the exact bearer token", () => {
    expect(isResearchAgentAuthorized(request("Bearer agent-token-123"))).toBe(true);
    expect(isResearchAgentAuthorized(request("Bearer agent-token-124"))).toBe(false);
    expect(isResearchAgentAuthorized(request("Basic agent-token-123"))).toBe(false);
    expect(isResearchAgentAuthorized(request())).toBe(false);
  });

  it("scopes the token to the research REST routes", () => {
    expect(isResearchAgentPath("/mcp")).toBe(false);
    expect(isResearchAgentPath("/api/research/topics/x/ingest")).toBe(true);
    expect(isResearchAgentPath("/api/docs")).toBe(false);
    expect(isResearchAgentPath("/research")).toBe(false);
  });
});
