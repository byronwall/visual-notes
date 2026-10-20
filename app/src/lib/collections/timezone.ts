/** Remembers the browser's time zone so the server computes "today" the same way. */
export function rememberTimeZone() {
  if (typeof document === "undefined") return;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || document.cookie.includes(`vn_tz=${encodeURIComponent(tz)}`)) return;
    document.cookie = `vn_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies unavailable: the server clock is used instead.
  }
}
