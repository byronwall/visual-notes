import { prisma } from "~/server/db";
import { hashToken, randomToken } from "./crypto";
import { isRegisteredRedirectUri } from "./clients";
import {
  AUTHORIZATION_CODE_TTL_SECONDS,
  DEFAULT_SCOPE,
  SCOPES,
  issuerFor,
  resourceFor,
} from "./metadata";

export type AuthorizeParams = Record<string, string | undefined>;

export type ValidAuthorizeRequest = {
  clientId: string;
  clientName: string | null;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  state?: string;
};

export type AuthorizeCheck =
  | { kind: "ok"; request: ValidAuthorizeRequest }
  /** Client or redirect URI can't be trusted: show the error, never redirect. */
  | { kind: "fatal"; message: string }
  /** Trusted redirect URI: send the error back to the client. */
  | { kind: "redirect"; url: string };

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function buildRedirect(
  redirectUri: string,
  issuer: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  // RFC 9207: every response, success or error, names the issuer.
  url.searchParams.set("iss", issuer);
  return url.toString();
}

function normalizeScope(raw: string | undefined): string | null {
  if (!raw?.trim()) return DEFAULT_SCOPE;
  const requested = raw.split(/\s+/).filter(Boolean);
  // ChatGPT may ask for OIDC scopes; this server has no ID tokens, so ignore them.
  const known = requested.filter((scope) =>
    (SCOPES as readonly string[]).includes(scope),
  );
  const unknown = requested.filter(
    (scope) =>
      !known.includes(scope) &&
      !["openid", "email", "profile", "offline_access"].includes(scope),
  );
  if (unknown.length) return null;
  return known.length ? known.join(" ") : DEFAULT_SCOPE;
}

export async function checkAuthorizeRequest(
  request: Request,
  params: AuthorizeParams,
): Promise<AuthorizeCheck> {
  const issuer = issuerFor(request);
  const clientId = params.client_id;
  if (!clientId) return { kind: "fatal", message: "Missing client_id." };
  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientId },
  });
  if (!client) return { kind: "fatal", message: "Unknown client." };
  const redirectUri =
    params.redirect_uri ??
    (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (
    !redirectUri ||
    !isRegisteredRedirectUri(client.redirectUris, redirectUri)
  ) {
    return {
      kind: "fatal",
      message: "The redirect URI is not registered for this client.",
    };
  }
  const fail = (error: string, description: string): AuthorizeCheck => ({
    kind: "redirect",
    url: buildRedirect(redirectUri, issuer, {
      error,
      error_description: description,
      state: params.state,
    }),
  });

  if (params.response_type !== "code") {
    return fail("unsupported_response_type", "Only response_type=code");
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return fail("invalid_request", "PKCE with S256 is required");
  }
  const expectedResource = resourceFor(request);
  if (
    params.resource &&
    trimSlash(params.resource) !== trimSlash(expectedResource)
  ) {
    return fail("invalid_target", `Unknown resource ${params.resource}`);
  }
  const scope = normalizeScope(params.scope);
  if (!scope) return fail("invalid_scope", "Unsupported scope requested");

  return {
    kind: "ok",
    request: {
      clientId,
      clientName: client.clientName,
      redirectUri,
      codeChallenge: params.code_challenge,
      resource: expectedResource,
      scope,
      state: params.state,
    },
  };
}

/** Issues a single-use code and returns the client redirect URL. */
export async function approveAuthorizeRequest(
  request: Request,
  valid: ValidAuthorizeRequest,
): Promise<string> {
  const code = randomToken();
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: valid.clientId,
      redirectUri: valid.redirectUri,
      codeChallenge: valid.codeChallenge,
      resource: valid.resource,
      scope: valid.scope,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000),
    },
  });
  console.info(`[oauth] approved client ${valid.clientId}`);
  return buildRedirect(valid.redirectUri, issuerFor(request), {
    code,
    state: valid.state,
  });
}

export function denyAuthorizeRequest(
  request: Request,
  valid: ValidAuthorizeRequest,
): string {
  console.info(`[oauth] denied client ${valid.clientId}`);
  return buildRedirect(valid.redirectUri, issuerFor(request), {
    error: "access_denied",
    error_description: "The user declined the connection",
    state: valid.state,
  });
}
