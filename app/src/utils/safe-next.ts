/** Same-origin path to return to after login, or null if unsafe. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  if (raw === "/login" || raw.startsWith("/login?")) return null;
  return raw;
}

export function loginPathFor(nextPath: string): string {
  const next = safeNextPath(nextPath);
  return next && next !== "/"
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
}
