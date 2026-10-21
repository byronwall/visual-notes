import { useAction } from "@solidjs/router";
import { createEffect } from "solid-js";
import { logRecentView } from "./recents.actions";
import type { RecentViewKind } from "./recents.types";

/**
 * Logs a page visit for the sidebar's Recent list whenever the entity id
 * changes. Effects only run in the browser, so SSR never logs a visit.
 */
export function useRecordRecentView(
  kind: RecentViewKind,
  id: () => string | null | undefined,
) {
  const record = useAction(logRecentView);
  let lastId = "";
  createEffect(() => {
    const next = id()?.trim();
    if (!next || next === lastId) return;
    lastId = next;
    void record(kind, next).catch((error) =>
      console.warn("[recents] failed to log view", { kind, error }),
    );
  });
}
