import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function randomToken(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

/** Codes and refresh tokens are stored only as SHA-256 hashes. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** RFC 7636 S256: BASE64URL(SHA256(code_verifier)) === code_challenge. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const expected = Buffer.from(
    base64Url(createHash("sha256").update(verifier, "ascii").digest()),
  );
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type AccessTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  client_id: string;
  gid: string;
  scope: string;
  iat: number;
  exp: number;
};

function sign(data: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(data).digest());
}

export function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "at+jwt" }));
  const payload = base64Url(JSON.stringify(claims));
  return `${header}.${payload}.${sign(`${header}.${payload}`, secret)}`;
}

/** Signature check only; callers validate iss/aud/exp/scope. */
export function decodeAccessToken(
  token: string,
  secret: string,
): AccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${payload}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const parsedHeader = JSON.parse(fromBase64Url(header).toString("utf8"));
    if (parsedHeader.alg !== "HS256") return null;
    return JSON.parse(fromBase64Url(payload).toString("utf8"));
  } catch {
    return null;
  }
}
