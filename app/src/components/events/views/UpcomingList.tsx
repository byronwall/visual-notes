import { For, Show, createMemo, createResource } from "solid-js";
import { css } from "styled-system/css";
import { formatLocalDate } from "~/lib/events/format";
import { groupByDay } from "~/lib/events/grouping";
import { hasActiveFilters } from "~/lib/events/filters";
import { addDays } from "~/lib/events/time";
import type { ShowsView, ShowsViewInput } from "~/lib/events/view-types";
import { refetchableShows } from "./refetchableShows";
import { EventsEmptyState } from "./EventsEmptyState";
import { EventsFilterBar } from "./EventsFilterBar";
import { UpcomingRow } from "./UpcomingRow";
import { ShowsRefreshContext } from "./ShowsRefresh";
import { useEventsFilters } from "./useEventsFilters";

const dayHead = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  px: "2",
  pt: "4",
  pb: "1",
  fontSize: "sm",
  fontWeight: "semibold",
  color: "fg.default",
  "& span": { fontWeight: "normal", color: "fg.subtle", fontSize: "xs" },
  "&[data-past]": { color: "fg.muted" },
});
const summary = css({ fontSize: "xs", color: "fg.subtle", px: "2" });

const countLabel = (count: number, one: string) =>
  `${count} ${one}${count === 1 ? "" : "s"}`;

const relative = (date: string, today: string) => {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return "";
};

/** Shows from today (or 30 days back) forward, grouped by local day. */
export function UpcomingList() {
  const api = useEventsFilters();
  const [view, { refetch }] = createResource<ShowsView, ShowsViewInput>(
    () => ({ ...api.filters() }),
    (input, info) => refetchableShows(input, info),
  );
  const today = () => view.latest?.today ?? "";
  const groups = createMemo(() => groupByDay(view.latest?.items ?? []));
  const year = () => Number(today().slice(0, 4)) || undefined;

  return (
    <ShowsRefreshContext.Provider value={async () => refetch()}>
      <EventsFilterBar api={api} />
      <Show when={view.latest}>
        <Show
          when={groups().length > 0}
          fallback={
            <EventsEmptyState
              filtered={hasActiveFilters(api.filters())}
              onClear={api.clear}
            />
          }
        >
          <div class={summary}>
            {countLabel(view.latest!.items.length, "show")} on{" "}
            {countLabel(groups().length, "day")}
          </div>
          <For each={groups()}>
            {(group) => (
              <section aria-label={formatLocalDate(group.date)}>
                <h2
                  class={dayHead}
                  data-past={group.date < today() ? "" : undefined}
                >
                  {formatLocalDate(group.date, year())}
                  <Show when={relative(group.date, today())}>
                    {(r) => <span>{r()}</span>}
                  </Show>
                </h2>
                <For each={group.shows}>
                  {(show) => <UpcomingRow show={show} />}
                </For>
              </section>
            )}
          </For>
        </Show>
      </Show>
    </ShowsRefreshContext.Provider>
  );
}
