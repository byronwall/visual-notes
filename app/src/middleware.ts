import { createMiddleware } from "@solidjs/start/middleware";
import { isArchiveIngestAuthorized } from "~/server/lib/archive/auth";
import {
  isResearchAgentAuthorized,
  isResearchAgentPath,
} from "~/server/lib/research/auth";
import { isRequestAuthenticated } from "~/server/magic-auth";
import { handleWellKnown } from "~/server/oauth/route-helpers";
import { loginPathFor } from "~/utils/safe-next";
import { scheduleEmbeddingRefresh } from "~/server/notes/embedding-refresh";
import { setContentWriteHook } from "~/server/notes/note-store";

// Middleware loads for every server router (pages, server functions, API), so
// content writes from any of them queue the embedding refresh.
setContentWriteHook(scheduleEmbeddingRefresh);

// SolidStart's pinned transform builds IDs from the root-relative module path
// and exported function name. Keep these IDs in sync with those public functions.
const publicServerFunctionIds = new Set([
  "src_services_auth_magic-auth_actions_ts--magicLogin_action",
  "src_services_auth_magic-auth_queries_ts--fetchMagicSession_query",
  "src_services_doc-shares_queries_ts--fetchPublicSharedDoc_query",
]);

function getServerFunctionId(request: Request): string | null {
  const url = new URL(request.url);
  const serverId = request.headers.get("X-Server-Id");
  if (serverId) return serverId.split("#", 1)[0] || null;
  return url.searchParams.get("id");
}

function isPublicServerFunctionRequest(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/_server" && pathname !== "/_server/") return false;
  const functionId = getServerFunctionId(request);
  return functionId !== null && publicServerFunctionIds.has(functionId);
}

function isServerFunctionPath(pathname: string): boolean {
  return pathname === "/_server" || pathname.startsWith("/_server/");
}

function isAssetPath(pathname: string): boolean {
  if (
    pathname.startsWith("/_build/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/site.webmanifest"
  )
    return true;
  return /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|map)$/.test(pathname);
}

export function isAllowedUnauthed(request: Request): boolean {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/share/")) return true;
  if (pathname.startsWith("/share-og/")) return true;
  if (pathname === "/api/archive/extension-package") return true;
  // The MCP connector and its OAuth endpoints authenticate on their own.
  // /oauth/authorize is deliberately absent: it needs the login cookie.
  if (pathname === "/mcp") return true;
  if (pathname === "/oauth/register" || pathname === "/oauth/token")
    return true;
  if (pathname.startsWith("/.well-known/oauth-")) return true;
  // Server functions need an identity check before generic asset extensions.
  if (isServerFunctionPath(pathname)) {
    return isPublicServerFunctionRequest(request);
  }
  // Keep legacy auth endpoints reachable (not used by the app now)
  if (pathname.startsWith("/api/auth")) return true;
  return isAssetPath(pathname);
}

export default createMiddleware({
  onRequest: [
    async (event) => {
      const url = new URL(event.request.url);
      const pathname = url.pathname;

      const wellKnown = handleWellKnown(event.request);
      if (wellKnown) return wellKnown;

      if (isAllowedUnauthed(event.request)) return;

      if (
        pathname.startsWith("/api/archive/bulk-capture") ||
        pathname.startsWith("/api/archive/targeted-capture") ||
        pathname.startsWith("/api/archive/lookup") ||
        pathname.startsWith("/api/archive/groups")
      ) {
        if (isArchiveIngestAuthorized(event.request)) return;
      }

      if (
        isResearchAgentPath(pathname) &&
        isResearchAgentAuthorized(event.request)
      ) {
        return;
      }

      const authed = isRequestAuthenticated(event.request);
      if (authed) return;

      // Block
      if (pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (isServerFunctionPath(pathname)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Error": "Unauthorized",
          },
        });
      }
      return Response.redirect(
        `${url.origin}${loginPathFor(pathname + url.search)}`,
        302,
      );
    },
  ],
});
