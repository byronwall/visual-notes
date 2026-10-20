type SolidHydrationGlobal = { completed?: WeakSet<Node> | null };

const POLL_MS = 25;
const TIMEOUT_MS = 10_000;

/**
 * True while server-rendered content is still arriving or waiting for client
 * hydration.
 *
 * `onMount` in the app shell runs once the shell hydrates, but SSR streams a
 * pending Suspense boundary's markup later in the same response, and that
 * boundary hydrates only after its data arrives. Until then its markup is
 * inert: a click on it is dropped, and Solid may replace the whole subtree with
 * a fresh client render. Solid records every server node it has claimed in
 * `_$HY.completed` (and clears it once hydration is over), so a keyed node
 * missing from that set is still pending.
 */
const hasPendingHydration = (root: ParentNode) => {
  if (document.readyState === "loading") return true;
  const completed = (globalThis as { _$HY?: SolidHydrationGlobal })._$HY
    ?.completed;
  if (!completed) return false;
  for (const node of root.querySelectorAll("[data-hk]")) {
    if (!completed.has(node)) return true;
  }
  return false;
};

/**
 * Calls `onSettled` once every server-rendered node under `root` is hydrated
 * (or was replaced). Gives up after a timeout with a warning so a stuck
 * boundary is visible instead of hanging whoever waits on it. Returns a cancel
 * function.
 */
export const whenHydrationSettles = (
  root: ParentNode,
  onSettled: () => void,
) => {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    timer = undefined;
    if (hasPendingHydration(root)) {
      if (Date.now() - startedAt < TIMEOUT_MS) {
        timer = setTimeout(check, POLL_MS);
        return;
      }
      console.warn(
        `[hydration] server nodes still unhydrated after ${TIMEOUT_MS}ms`,
      );
    }
    onSettled();
  };
  check();
  return () => {
    if (timer) clearTimeout(timer);
  };
};
