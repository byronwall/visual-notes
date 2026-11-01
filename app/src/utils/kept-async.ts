import { createAsync } from "@solidjs/router";

// Chrome, Firefox and Safari wordings of a fetch that never reached the server.
const NETWORK_ERROR = /Failed to fetch|NetworkError|Load failed/;

/**
 * Keeps `prev` when a read can't reach the server. Reading an errored
 * resource throws into the app's ErrorBoundary, which unmounts the page and
 * any unsaved note text in it. Every other error still reaches the boundary,
 * including a stale tab's missing route, which needs its reload button.
 */
export const keepOnFailedRead = async <T>(
  prev: T | undefined,
  read: () => Promise<T>,
) => {
  try {
    return await read();
  } catch (err) {
    if (!NETWORK_ERROR.test(String(err))) throw err;
    console.warn("[failed-read] kept the last value", err);
    return prev;
  }
};

/**
 * Options for a resource that starts fetching after an interaction, such as a
 * picker keyed on `open()`. Without a value, its first `.latest` read suspends
 * like a plain read, and that boundary is often the page's.
 */
export const onDemand = { initialValue: undefined };

/**
 * `createAsync` for a read that stays mounted beside a note editor. A live
 * refresh or a landed action reruns it at any time, so a network drop can
 * fail it while the note holds unsaved text.
 */
export const createKeptAsync = <T>(
  read: () => Promise<T>,
  options?: typeof onDemand,
) =>
  createAsync<T | undefined>((prev) => keepOnFailedRead(prev, read), options);
