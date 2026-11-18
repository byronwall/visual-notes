import { For, Show, createMemo, createResource } from "solid-js";
import { css } from "styled-system/css";
import { formatLocalDate } from "~/lib/events/format";
import { groupByDay } from "~/lib/events/grouping";
import { hasActiveFilters } from "~/lib/events/filters";
import { addDays } from "~/lib/events/time";
import type { ShowsView, ShowsViewInput } from "~/lib/events/view-types";
import { RowList, RowListGroup, RowListSpan } from "~/components/ui/row-list";
import { refetchableShows } from "./refetchableShows";
import { EventsEmptyState } from "./EventsEmptyState";
import { EventsFilterBar } from "./EventsFilterBar";
import { UpcomingRow } from "./UpcomingRow";
import { ShowsRefreshContext } from "./ShowsRefresh";
import { useEventsFilters } from "./useEventsFilters";

// Wide: day rail | time | title | place | decision. Narrow: the day is a
// heading and each row stacks (see UpcomingRow).
const cols = css({
  gridTemplateColumns: {
    base: "minmax(0, 1fr) auto",
    md: "max-content max-content minmax(0, 1fr) minmax(0, 14rem) auto",
  },
});
// No rules between days: a gap opens where a new week starts.
const day = css({
  pt: { base: "3", md: "0" },
  "&[data-week]:not(:first-child)": { mt: { base: "2", md: "4" } },
});
const dayHead = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  pb: { base: "1", md: "0" },
  fontSize: "sm",
  fontWeight: "semibold",
  color: "fg.default",
  whiteSpace: "nowrap",
  md: {
    pr: "3",
    gridColumn: "1",
    gridRow: "1 / span var(--day-rows)",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0",
    py: "1.5",
    // One line height of the rows' text, so the date sits on their baseline.
    lineHeight: "1.5rem",
  },
  "& span": {
    fontWeight: "normal",
    color: "fg.subtle",
    fontSize: "xs",
    md: { lineHeight: "1rem" },
  },
  "&[data-today]": { color: "fg.selected" },
  "&[data-past]": { color: "fg.muted" },
});
const summary = css({
  fontSize: "xs",
  color: "fg.subtle",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  ml: "auto",
});

const countLabel = (count: number, one: string) =>
  `${count} ${one}${count === 1 ? "" : "s"}`;

/** Monday of the week holding `date` (YYYY-MM-DD). */
const weekOf = (date: string) =>
  addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

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
  const newWeek = (i: number) =>
    i > 0 && weekOf(groups()[i].date) !== weekOf(groups()[i - 1].date);
  const year = () => Number(today().slice(0, 4)) || undefined;

  return (
    <ShowsRefreshContext.Provider value={async () => refetch()}>
      <EventsFilterBar api={api}>
        <Show when={view.latest?.items.length}>
          {(count) => (
            <span class={summary}>
              {countLabel(count(), "show")} on{" "}
              {countLabel(groups().length, "day")}
            </span>
          )}
        </Show>
      </EventsFilterBar>
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
          <RowList class={cols}>
            <For each={groups()}>
              {(group, i) => (
                <RowListGroup
                  class={day}
                  aria-label={formatLocalDate(group.date)}
                  data-week={newWeek(i()) ? "" : undefined}
                  style={{ "--day-rows": group.shows.length }}
                >
                  <RowListSpan
                    as="h2"
                    class={dayHead}
                    data-today={group.date === today() ? "" : undefined}
                    data-past={group.date < today() ? "" : undefined}
                  >
                    {formatLocalDate(group.date, year())}
                    <Show when={relative(group.date, today())}>
                      {(r) => <span>{r()}</span>}
                    </Show>
                  </RowListSpan>
                  <For each={group.shows}>
                    {(show) => (
                      <UpcomingRow show={show} past={group.date < today()} />
                    )}
                  </For>
                </RowListGroup>
              )}
            </For>
          </RowList>
        </Show>
      </Show>
    </ShowsRefreshContext.Provider>
  );
}
