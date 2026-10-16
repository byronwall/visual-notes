import { afterAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("AUTH_SECRET", "middleware-test-secret");
vi.stubEnv("MAGIC_PASSWORD", "middleware-test-password");
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");

const { isAllowedUnauthed } = await import("./middleware");
const { isRequestAuthenticated, issueMagicToken } = await import(
  "./server/magic-auth"
);

afterAll(() => vi.unstubAllEnvs());

const functionIds = {
  login: "src_services_auth_magic-auth_actions_ts--magicLogin_action",
  session: "src_services_auth_magic-auth_queries_ts--fetchMagicSession_query",
  sharedDoc: "src_services_doc-shares_queries_ts--fetchPublicSharedDoc_query",
} as const;

function serverRequest(path: string, options: RequestInit = {}): Request {
  return new Request(`http://notes.test${path}`, options);
}

describe("server function auth boundary", () => {
  it("allows only the login, session, and public-share functions without a cookie", () => {
    expect(
      isAllowedUnauthed(
        serverRequest(`/_server/?id=${functionIds.session}&name=anything`),
      ),
    ).toBe(true);
    expect(
      isAllowedUnauthed(
        serverRequest(`/_server?id=${functionIds.sharedDoc}&name=anything`),
      ),
    ).toBe(true);
    expect(
      isAllowedUnauthed(
        serverRequest("/_server/", {
          method: "POST",
          headers: { "X-Server-Id": `${functionIds.login}#/login` },
        }),
      ),
    ).toBe(true);
  });

  it("does not trust the name, Referer, or query ID when the dispatch header is private", () => {
    const referer = "http://notes.test/login";
    expect(
      isAllowedUnauthed(
        serverRequest(
          `/_server/?id=${functionIds.sharedDoc}&name=doc-share-public`,
          {
            headers: {
              "X-Server-Id": "private-server-function#/login",
              Referer: referer,
            },
          },
        ),
      ),
    ).toBe(false);
    expect(
      isAllowedUnauthed(
        serverRequest("/_server", {
          method: "POST",
          headers: {
            "X-Server-Id": "private-server-function#magic-login",
            Referer: referer,
          },
        }),
      ),
    ).toBe(false);
  });

  it("denies unknown, private, and asset-shaped server-function paths anonymously", () => {
    expect(
      isAllowedUnauthed(
        serverRequest("/_server/?id=unknown-function&name=public"),
      ),
    ).toBe(false);
    expect(
      isAllowedUnauthed(
        serverRequest("/_server/private.js?id=private-function"),
      ),
    ).toBe(false);
  });

  it("allows a private server function only when the magic cookie is valid", () => {
    const request = serverRequest("/_server", {
      method: "POST",
      headers: {
        "X-Server-Id": "private-server-function#anything",
        Cookie: `magic_auth=${issueMagicToken()}`,
      },
    });

    expect(isAllowedUnauthed(request)).toBe(false);
    expect(isRequestAuthenticated(request)).toBe(true);
  });

  it("treats malformed cookie encoding as unauthenticated", () => {
    expect(() =>
      isRequestAuthenticated(
        serverRequest("/_server", {
          headers: { Cookie: "magic_auth=%E0%A4%A" },
        }),
      ),
    ).not.toThrow();
    expect(
      isRequestAuthenticated(
        serverRequest("/_server", {
          headers: { Cookie: "magic_auth=%E0%A4%A" },
        }),
      ),
    ).toBe(false);
  });
});
