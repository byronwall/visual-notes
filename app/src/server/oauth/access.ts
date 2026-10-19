import { prisma } from "~/server/db";
import { decodeAccessToken } from "./crypto";
import {
  getTokenSecret,
  issuerFor,
  resourceFor,
  resourceMetadataUrl,
} from "./metadata";

export type AccessGrant = {
  actorId: string;
  scopes: string[];
  grantId: string;
};

export type AccessCheck =
  | { ok: true; grant: AccessGrant }
  | {
      ok: false;
      error: "invalid_request" | "invalid_token";
      description: string;
    };

/**
 * Verifies signature, issuer, audience, lifetime, and that the grant is not
 * revoked. Checking the grant row on each call makes revocation immediate.
 */
export async function verifyBearerAccessToken(
  request: Request,
  token: string | null,
): Promise<AccessCheck> {
  if (!token) {
    return {
      ok: false,
      error: "invalid_request",
      description: "No access token provided",
    };
  }
  const secret = getTokenSecret();
  const claims = secret ? decodeAccessToken(token, secret) : null;
  if (!claims) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token is not valid",
    };
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== issuerFor(request) ||
    claims.aud !== resourceFor(request)
  ) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Token was issued for another resource",
    };
  }
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Access token expired",
    };
  }
  const grant = await prisma.oAuthGrant.findUnique({
    where: { id: claims.gid },
    select: { id: true, revokedAt: true },
  });
  if (!grant || grant.revokedAt) {
    return {
      ok: false,
      error: "invalid_token",
      description: "Connection was revoked",
    };
  }
  return {
    ok: true,
    grant: {
      actorId: `chatgpt:${claims.client_id}`,
      scopes: claims.scope.split(/\s+/).filter(Boolean),
      grantId: grant.id,
    },
  };
}

export function wwwAuthenticateHeader(
  request: Request,
  error: string,
  description: string,
): string {
  return `Bearer resource_metadata="${resourceMetadataUrl(request)}", error="${error}", error_description="${description}"`;
}

export function unauthorizedResponse(
  request: Request,
  error: string,
  description: string,
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": wwwAuthenticateHeader(request, error, description),
      },
    },
  );
}
