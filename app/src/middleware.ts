import { createMiddleware } from "@solidjs/start/middleware";
import { isRequestAuthenticated } from "~/server/magic-auth";

function isAssetPath(pathname: string): boolean {
  if (
    pathname.startsWith("/_build/") ||
    pathname.startsWith("/_server/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/site.webmanifest"
  )
    return true;
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|map)$/.test(pathname);
}

function isAllowedUnauthed(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/api/magic-login") return true;
  if (pathname === "/api/logout") return true;
  if (pathname === "/api/magic-session") return true;
  // Keep legacy auth endpoints reachable (not used by the app now)
  if (pathname.startsWith("/api/auth")) return true;
  return isAssetPath(pathname);
}

export default createMiddleware({
  onRequest: [
    async (event) => {
      const url = new URL(event.request.url);
      const pathname = url.pathname;

      if (isAllowedUnauthed(pathname)) return;

      const authed = isRequestAuthenticated(event.request);
      if (authed) return;

      // Block
      if (pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return Response.redirect(`${url.origin}/login`, 302);
    },
  ],
});
