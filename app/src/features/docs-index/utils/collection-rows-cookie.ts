import { getRequestEvent, isServer } from "solid-js/web";

const COOKIE = "vn_show_collection_rows";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** A cookie, so the server renders the same list the client hydrates. */
export const readShowCollectionRows = (): boolean => {
  const header = isServer
    ? getRequestEvent()?.request.headers.get("cookie")
    : document.cookie;
  return !!header?.split(";").some((part) => part.trim() === `${COOKIE}=1`);
};

export const writeShowCollectionRows = (show: boolean) => {
  if (isServer) return;
  document.cookie = `${COOKIE}=${show ? "1" : "0"}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
};
