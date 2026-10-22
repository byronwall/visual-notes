import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  serverEnv: {
    NODE_ENV: "development",
    MCP_TOKEN_SECRET: "test-secret",
    PUBLIC_BASE_URL: "https://notes.test",
  } as Record<string, string | undefined>,
}));
const db = vi.hoisted(() => ({
  oAuthClient: { findUnique: vi.fn(), create: vi.fn() },
  oAuthAuthorizationCode: { create: vi.fn(), delete: vi.fn() },
  oAuthGrant: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn(),
  },
}));
vi.mock("~/env/server", () => env);
vi.mock("~/server/db", () => ({ prisma: db }));

import { verifyBearerAccessToken } from "./access";
import { checkAuthorizeRequest } from "./authorize";
import { isAllowedRedirectUri, isRegisteredRedirectUri } from "./clients";
import {
  base64Url,
  decodeAccessToken,
  hashToken,
  signAccessToken,
  verifyPkceS256,
} from "./crypto";
import { handleTokenRequest } from "./token";

const request = new Request("https://notes.test/oauth/token", {
  method: "POST",
});
const verifier = "v".repeat(50);
const challenge = base64Url(createHash("sha256").update(verifier).digest());
const client = {
  id: "c1",
  clientName: "ChatGPT",
  redirectUris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
};

function tokenRequest(fields: Record<string, string>): Request {
  return new Request("https://notes.test/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://notes.test",
    aud: "https://notes.test/mcp",
    sub: "owner",
    client_id: "c1",
    gid: "g1",
    scope: "notes:read notes:write",
    iat: now,
    exp: now + 60,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.oAuthGrant.update.mockResolvedValue({});
  env.serverEnv.NODE_ENV = "development";
});

describe("crypto", () => {
  it("verifies PKCE S256 and rejects a wrong verifier", () => {
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256("w".repeat(50), challenge)).toBe(false);
    expect(verifyPkceS256("short", challenge)).toBe(false);
  });

  it("rejects tokens signed with another secret", () => {
    const token = signAccessToken(claims(), "other-secret");
    expect(decodeAccessToken(token, "test-secret")).toBeNull();
  });
});

describe("redirect URIs", () => {
  it("allows https and loopback http, including in production", () => {
    env.serverEnv.NODE_ENV = "production";
    expect(isAllowedRedirectUri(client.redirectUris[0])).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:52986/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:6274/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.test/cb")).toBe(false);
    expect(isAllowedRedirectUri("http://localhost.evil.test/cb")).toBe(false);
  });

  it("matches loopback redirects on any port, others exactly", () => {
    const registered = [
      "http://localhost:52986/callback",
      "https://chatgpt.com/cb",
    ];
    expect(
      isRegisteredRedirectUri(registered, "http://localhost:60001/callback"),
    ).toBe(true);
    expect(
      isRegisteredRedirectUri(registered, "http://localhost:60001/other"),
    ).toBe(false);
    expect(
      isRegisteredRedirectUri(registered, "http://127.0.0.1:52986/callback"),
    ).toBe(false);
    expect(isRegisteredRedirectUri(registered, "https://chatgpt.com/cb")).toBe(
      true,
    );
    expect(
      isRegisteredRedirectUri(registered, "https://chatgpt.com:8443/cb"),
    ).toBe(false);
  });
});

describe("checkAuthorizeRequest", () => {
  const base = {
    client_id: "c1",
    redirect_uri: client.redirectUris[0],
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "s1",
    resource: "https://notes.test/mcp",
  };

  it("accepts a valid request and ignores OIDC scopes", async () => {
    db.oAuthClient.findUnique.mockResolvedValue(client);
    const check = await checkAuthorizeRequest(request, {
      ...base,
      scope: "openid email notes:read",
    });
    expect(check).toMatchObject({
      kind: "ok",
      request: { scope: "notes:read" },
    });
  });

  it("never redirects to an unregistered URI", async () => {
    db.oAuthClient.findUnique.mockResolvedValue(client);
    const check = await checkAuthorizeRequest(request, {
      ...base,
      redirect_uri: "https://evil.test/cb",
    });
    expect(check.kind).toBe("fatal");
  });

  it("accepts a registered loopback redirect on a new port", async () => {
    db.oAuthClient.findUnique.mockResolvedValue({
      ...client,
      redirectUris: ["http://localhost:52986/callback"],
    });
    const check = await checkAuthorizeRequest(request, {
      ...base,
      redirect_uri: "http://localhost:60001/callback",
    });
    expect(check).toMatchObject({
      kind: "ok",
      request: { redirectUri: "http://localhost:60001/callback" },
    });
  });

  it("returns protocol errors to the client with state and iss", async () => {
    db.oAuthClient.findUnique.mockResolvedValue(client);
    const check = await checkAuthorizeRequest(request, {
      ...base,
      code_challenge_method: "plain",
    });
    expect(check.kind).toBe("redirect");
    const url = new URL((check as { url: string }).url);
    expect(url.searchParams.get("error")).toBe("invalid_request");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("iss")).toBe("https://notes.test");
  });

  it("rejects a token audience for another resource", async () => {
    db.oAuthClient.findUnique.mockResolvedValue(client);
    const check = await checkAuthorizeRequest(request, {
      ...base,
      resource: "https://other.test/mcp",
    });
    expect(check.kind).toBe("redirect");
  });
});

describe("token endpoint", () => {
  const storedCode = {
    clientId: "c1",
    redirectUri: client.redirectUris[0],
    codeChallenge: challenge,
    resource: "https://notes.test/mcp",
    scope: "notes:read notes:write",
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("exchanges a code with the right verifier for audience-bound tokens", async () => {
    db.oAuthAuthorizationCode.delete.mockResolvedValue(storedCode);
    db.oAuthGrant.create.mockResolvedValue({ id: "g1", ...storedCode });
    const response = await handleTokenRequest(
      tokenRequest({
        grant_type: "authorization_code",
        code: "abc",
        code_verifier: verifier,
        client_id: "c1",
        redirect_uri: client.redirectUris[0],
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(db.oAuthAuthorizationCode.delete).toHaveBeenCalledWith({
      where: { codeHash: hashToken("abc") },
    });
    expect(decodeAccessToken(body.access_token, "test-secret")).toMatchObject({
      aud: "https://notes.test/mcp",
      gid: "g1",
    });
    expect(body.refresh_token).toBeTruthy();
  });

  it("rejects a PKCE mismatch", async () => {
    db.oAuthAuthorizationCode.delete.mockResolvedValue(storedCode);
    const response = await handleTokenRequest(
      tokenRequest({
        grant_type: "authorization_code",
        code: "abc",
        code_verifier: "x".repeat(50),
        client_id: "c1",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_grant");
    expect(db.oAuthGrant.create).not.toHaveBeenCalled();
  });

  it("rejects a used or unknown code", async () => {
    db.oAuthAuthorizationCode.delete.mockRejectedValue(new Error("not found"));
    const response = await handleTokenRequest(
      tokenRequest({
        grant_type: "authorization_code",
        code: "abc",
        code_verifier: verifier,
        client_id: "c1",
      }),
    );
    expect((await response.json()).error).toBe("invalid_grant");
  });

  it("rotates refresh tokens and refuses revoked or reused ones", async () => {
    const grant = { id: "g1", ...storedCode, revokedAt: null };
    db.oAuthGrant.findUnique.mockResolvedValue(grant);
    db.oAuthGrant.updateMany.mockResolvedValue({ count: 1 });
    const ok = await handleTokenRequest(
      tokenRequest({ grant_type: "refresh_token", refresh_token: "r1" }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).refresh_token).not.toBe("r1");

    db.oAuthGrant.updateMany.mockResolvedValue({ count: 0 });
    const reused = await handleTokenRequest(
      tokenRequest({ grant_type: "refresh_token", refresh_token: "r1" }),
    );
    expect((await reused.json()).error).toBe("invalid_grant");

    db.oAuthGrant.findUnique.mockResolvedValue({
      ...grant,
      revokedAt: new Date(),
    });
    const revoked = await handleTokenRequest(
      tokenRequest({ grant_type: "refresh_token", refresh_token: "r2" }),
    );
    expect((await revoked.json()).error).toBe("invalid_grant");
  });
});

describe("verifyBearerAccessToken", () => {
  const mcpRequest = new Request("https://notes.test/mcp", { method: "POST" });

  it("accepts a live token for an active grant", async () => {
    db.oAuthGrant.findUnique.mockResolvedValue({ id: "g1", revokedAt: null });
    const check = await verifyBearerAccessToken(
      mcpRequest,
      signAccessToken(claims(), "test-secret"),
    );
    expect(check).toMatchObject({
      ok: true,
      grant: { actorId: "chatgpt:c1", scopes: ["notes:read", "notes:write"] },
    });
  });

  it.each([
    ["expired", claims({ exp: Math.floor(Date.now() / 1000) - 1 })],
    ["wrong audience", claims({ aud: "https://other.test/mcp" })],
    ["wrong issuer", claims({ iss: "https://other.test" })],
  ])("rejects %s tokens", async (_label, tokenClaims) => {
    db.oAuthGrant.findUnique.mockResolvedValue({ id: "g1", revokedAt: null });
    const check = await verifyBearerAccessToken(
      mcpRequest,
      signAccessToken(tokenClaims, "test-secret"),
    );
    expect(check.ok).toBe(false);
  });

  it("rejects tokens whose grant was revoked", async () => {
    db.oAuthGrant.findUnique.mockResolvedValue({
      id: "g1",
      revokedAt: new Date(),
    });
    const check = await verifyBearerAccessToken(
      mcpRequest,
      signAccessToken(claims(), "test-secret"),
    );
    expect(check).toMatchObject({ ok: false, error: "invalid_token" });
  });
});
