import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "~/env/server";

const tokensMatch = (actual: string, expected: string) => {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** REST agents and seed scripts authenticate with `Authorization: Bearer <RESEARCH_AGENT_TOKEN>`. MCP uses the connector's own auth. */
export function isResearchAgentAuthorized(request: Request): boolean {
  const expected = serverEnv.RESEARCH_AGENT_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization")?.trim();
  if (!header) return false;
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) return false;
  return tokensMatch(token, expected);
}

export const isResearchAgentPath = (pathname: string) => pathname.startsWith("/api/research/");

export function researchJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
