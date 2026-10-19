import { getRequestEvent, isServer } from "solid-js/web";

export const SIDEBAR_COLLAPSED_COOKIE = "vn_sidebar_collapsed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const parseSidebarCollapsedCookie = (
  cookieHeader: string | null | undefined
): boolean => {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((part) => part.trim() === `${SIDEBAR_COLLAPSED_COOKIE}=1`);
};

/**
 * Reads the persisted collapse state from a cookie (not localStorage) so the
 * server renders the same sidebar width the client hydrates with: no shift.
 */
export const readSidebarCollapsed = (): boolean => {
  if (isServer) {
    const header = getRequestEvent()?.request.headers.get("cookie");
    return parseSidebarCollapsedCookie(header);
  }
  return parseSidebarCollapsedCookie(document.cookie);
};

export const writeSidebarCollapsed = (collapsed: boolean) => {
  if (isServer) return;
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? "1" : "0"}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};
