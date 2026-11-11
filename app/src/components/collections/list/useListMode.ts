import { createSignal } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";

export type ListMode = "list" | "table";

const COOKIE = "vn_collection_layout";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Below this container width a table view shows the record list. */
export const LIST_MAX_WIDTH = 640;

/** A cookie, so the server renders the same layout the client hydrates. */
const readMode = (): ListMode => {
  const header = isServer
    ? getRequestEvent()?.request.headers.get("cookie")
    : document.cookie;
  const table = header
    ?.split(";")
    .some((part) => part.trim() === `${COOKIE}=table`);
  return table ? "table" : "list";
};

/**
 * The narrow-screen layout of a table view, remembered per device. It applies
 * only below LIST_MAX_WIDTH; wider containers always show the table.
 */
export const createListMode = () => {
  const [mode, setMode] = createSignal<ListMode>(readMode());
  const set = (next: ListMode) => {
    setMode(next);
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  };
  return { mode, set };
};

export type ListModeState = ReturnType<typeof createListMode>;
