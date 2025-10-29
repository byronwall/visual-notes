import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "~/env/server";

type JwtPayload = {
  ok: boolean;
  iat: number;
  exp: number;
};

export const MAGIC_COOKIE_NAME = "magic_auth";

function base64UrlEncode(input: string | Buffer): string {
  const buff = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buff
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const normalized =
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64");
}

function hmacSha256(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function issueMagicToken(ttlSeconds = 60 * 60 * 24 * 30): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { ok: true, iat: now, exp: now + ttlSeconds };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;
  const signature = base64UrlEncode(hmacSha256(data, serverEnv.AUTH_SECRET));
  const token = `${data}.${signature}`;
  return token;
}

export function verifyMagicToken(token: string): {
  valid: boolean;
  expired: boolean;
} {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, expired: false };
    const [headerPart, payloadPart, sigPart] = parts;
    const data = `${headerPart}.${payloadPart}`;
    const expected = hmacSha256(data, serverEnv.AUTH_SECRET);
    const actual = base64UrlDecode(sigPart);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return { valid: false, expired: false };
    }
    const payload: JwtPayload = JSON.parse(
      base64UrlDecode(payloadPart).toString("utf8")
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { valid: false, expired: true };
    if (payload.ok !== true) return { valid: false, expired: false };
    return { valid: true, expired: false };
  } catch {
    return { valid: false, expired: false };
  }
}

export function parseCookie(
  cookieHeader: string | null | undefined
): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!cookieHeader) return jar;
  const pairs = cookieHeader.split(/;\s*/);
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = decodeURIComponent(pair.slice(0, idx).trim());
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    jar[name] = value;
  }
  return jar;
}

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
};

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
  ];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  const isProd = serverEnv.NODE_ENV === "production";
  if (options.secure ?? isProd) parts.push("Secure");
  const sameSite = options.sameSite ?? "lax";
  parts.push(`SameSite=${sameSite}`);
  if (options.maxAge && Number.isFinite(options.maxAge))
    parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

export function buildAuthCookie(token: string): string {
  return serializeCookie(MAGIC_COOKIE_NAME, token, {
    httpOnly: true,
    secure: undefined,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(): string {
  return serializeCookie(MAGIC_COOKIE_NAME, "", {
    httpOnly: true,
    secure: undefined,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export function isRequestAuthenticated(request: Request): boolean {
  const cookies = parseCookie(request.headers.get("cookie"));
  const token = cookies[MAGIC_COOKIE_NAME];
  if (!token) return false;
  const result = verifyMagicToken(token);
  return result.valid;
}
