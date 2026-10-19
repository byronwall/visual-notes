import { prisma } from "~/server/db";
import {
  hashToken,
  randomToken,
  signAccessToken,
  verifyPkceS256,
} from "./crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  getTokenSecret,
  issuerFor,
  jsonResponse,
  oauthError,
} from "./metadata";

type Grant = { id: string; clientId: string; scope: string; resource: string };

async function readForm(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return new URLSearchParams(
      Object.entries(body).map(([key, value]) => [key, String(value)]),
    );
  }
  return new URLSearchParams(await request.text());
}

function tokenResponse(
  request: Request,
  grant: Grant,
  refreshToken: string,
  secret: string,
): Response {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signAccessToken(
    {
      iss: issuerFor(request),
      aud: grant.resource,
      sub: "owner",
      client_id: grant.clientId,
      gid: grant.id,
      scope: grant.scope,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    },
    secret,
  );
  return jsonResponse({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scope,
  });
}

async function exchangeCode(
  request: Request,
  form: URLSearchParams,
  secret: string,
): Promise<Response> {
  const code = form.get("code");
  const verifier = form.get("code_verifier");
  if (!code || !verifier) {
    return oauthError("invalid_request", "code and code_verifier are required");
  }
  // Delete-on-read makes the code single use even under concurrent requests.
  const stored = await prisma.oAuthAuthorizationCode
    .delete({ where: { codeHash: hashToken(code) } })
    .catch(() => null);
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    return oauthError(
      "invalid_grant",
      "Authorization code is invalid or expired",
    );
  }
  if (form.get("client_id") !== stored.clientId) {
    return oauthError("invalid_grant", "Code was issued to another client");
  }
  const redirectUri = form.get("redirect_uri");
  if (redirectUri && redirectUri !== stored.redirectUri) {
    return oauthError("invalid_grant", "redirect_uri does not match");
  }
  if (!verifyPkceS256(verifier, stored.codeChallenge)) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }
  const resource = form.get("resource");
  if (resource && resource.replace(/\/+$/, "") !== stored.resource) {
    return oauthError("invalid_target", "resource does not match the code");
  }
  const refreshToken = randomToken();
  const grant = await prisma.oAuthGrant.create({
    data: {
      clientId: stored.clientId,
      scope: stored.scope,
      resource: stored.resource,
      refreshTokenHash: hashToken(refreshToken),
      lastUsedAt: new Date(),
    },
  });
  console.info(`[oauth] issued grant ${grant.id} to ${grant.clientId}`);
  return tokenResponse(request, grant, refreshToken, secret);
}

async function refresh(
  request: Request,
  form: URLSearchParams,
  secret: string,
): Promise<Response> {
  const presented = form.get("refresh_token");
  if (!presented) {
    return oauthError("invalid_request", "refresh_token is required");
  }
  const grant = await prisma.oAuthGrant.findUnique({
    where: { refreshTokenHash: hashToken(presented) },
  });
  if (!grant || grant.revokedAt) {
    return oauthError("invalid_grant", "Refresh token is invalid or revoked");
  }
  if (form.get("client_id") && form.get("client_id") !== grant.clientId) {
    return oauthError(
      "invalid_grant",
      "Refresh token belongs to another client",
    );
  }
  const next = randomToken();
  // Rotate only if the presented token is still current (guards double use).
  const rotated = await prisma.oAuthGrant.updateMany({
    where: { id: grant.id, refreshTokenHash: hashToken(presented) },
    data: { refreshTokenHash: hashToken(next), lastUsedAt: new Date() },
  });
  if (rotated.count !== 1) {
    return oauthError("invalid_grant", "Refresh token was already used");
  }
  return tokenResponse(request, grant, next, secret);
}

/** RFC 6749 token endpoint: authorization_code (+PKCE) and refresh_token. */
export async function handleTokenRequest(request: Request): Promise<Response> {
  const secret = getTokenSecret();
  if (!secret) {
    return oauthError(
      "server_error",
      "MCP_TOKEN_SECRET is not configured",
      500,
    );
  }
  let form: URLSearchParams;
  try {
    form = await readForm(request);
  } catch {
    return oauthError("invalid_request", "Unreadable request body");
  }
  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") {
    return exchangeCode(request, form, secret);
  }
  if (grantType === "refresh_token") return refresh(request, form, secret);
  return oauthError(
    "unsupported_grant_type",
    `Unsupported grant_type ${grantType}`,
  );
}
