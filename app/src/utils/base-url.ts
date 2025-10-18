// Utility to compute a robust base URL for both server and client
// Handles common deployment providers and local dev.

function stripTrailingSlash(input: string): string {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

export function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    const envObj = (import.meta as any).env || {};
    const fromEnv = (envObj.VITE_PUBLIC_BASE_URL || envObj.VITE_APP_URL) as
      | string
      | undefined;
    if (fromEnv && typeof fromEnv === "string" && fromEnv.length > 0) {
      return stripTrailingSlash(fromEnv);
    }
    return stripTrailingSlash(window.location.origin);
  }

  // Server-side: prefer explicit env, then provider-specific, then localhost
  const env = process.env as Record<string, string | undefined>;
  const PUBLIC_BASE_URL = env.PUBLIC_BASE_URL || env.PUBLIC_APP_URL;
  const { AUTH_URL, VERCEL_URL, RENDER_EXTERNAL_URL, FLY_APP_NAME, PORT } = env;

  if (PUBLIC_BASE_URL) return stripTrailingSlash(PUBLIC_BASE_URL);
  if (AUTH_URL) return stripTrailingSlash(AUTH_URL);
  if (VERCEL_URL)
    return stripTrailingSlash(
      VERCEL_URL.startsWith("http") ? VERCEL_URL : `https://${VERCEL_URL}`
    );
  if (RENDER_EXTERNAL_URL)
    return stripTrailingSlash(
      RENDER_EXTERNAL_URL.startsWith("http")
        ? RENDER_EXTERNAL_URL
        : `https://${RENDER_EXTERNAL_URL}`
    );
  if (FLY_APP_NAME) return `https://${FLY_APP_NAME}.fly.dev`;

  const port = PORT && /^\d+$/.test(PORT) ? PORT : "3000";
  return `http://localhost:${port}`;
}

export async function apiFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  let url: string;
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      url = input;
    } else {
      const base = getBaseUrl();
      url = `${base}${input.startsWith("/") ? "" : "/"}${input}`;
    }
  } else {
    // Resolve relative URL against base on the server
    const base = getBaseUrl();
    url = new URL(input as URL, base).toString();
  }
  return fetch(url, { credentials: "include", ...init });
}
