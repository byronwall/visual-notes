import { ChevronLeftIcon, ChevronRightIcon } from "lucide-solid";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Button } from "~/components/ui/button";
import { monthGrid, shiftMonth } from "~/lib/collections/group";
import { formatLocalDate } from "~/lib/events/format";
import { showsByDate } from "~/lib/events/grouping";
import type { ShowsView, ShowsViewInput } from "~/lib/events/view-types";
import { refetchableShows } from "./refetchableShows";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { EventsFilterBar } from "./EventsFilterBar";
import { UpcomingRow } from "./UpcomingRow";
import { ShowsRefreshContext } from "./ShowsRefresh";
import { useEventsFilters } from "./useEventsFilters";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthLabel = css({
  fontSize: "lg",
  fontWeight: "semibold",
  minW: { base: "auto", md: "11rem" },
  whiteSpace: "nowrap",
});
const agendaHead = css({
  px: "2",
  pt: "4",
  pb: "1",
  fontSize: "sm",
  fontWeight: "semibold",
});
const muted = css({ px: "2", fontSize: "sm", color: "fg.subtle" });

const label = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
};

/** Month grid of shows; `?month=YYYY-MM` plus the shared filters. */
export function EventsCalendar() {
  const api = useEventsFilters();
  const monthParam = () => {
    const raw = api.params.month;
    return (Array.isArray(raw) ? raw[0] : raw) ?? "";
  };
  const [view, { refetch }] = createResource<ShowsView, ShowsViewInput>(
    () => ({ ...api.filters(), calendar: true, month: monthParam() }),
    (input, info) => refetchableShows(input, info),
  );
  const month = () => view.latest?.month ?? "";
  const today = () => view.latest?.today ?? "";
  const byDate = createMemo(() => showsByDate(view.latest?.items ?? []));
  const weeks = createMemo(() => (month() ? monthGrid(month(), today()) : []));

  const [picked, setPicked] = createSignal<string | null>(null);
  const selected = () =>
    picked() ?? (today().startsWith(month()) ? today() : `${month()}-01`);
  const selectedShows = () => byDate().get(selected()) ?? [];

  const goTo = (next: string | undefined) => {
    setPicked(null);
    api.setParams({ month: next }, { replace: true });
  };

  return (
    <ShowsRefreshContext.Provider value={async () => refetch()}>
      <EventsFilterBar api={api} hidePast />
      <Show when={view.latest}>
        <HStack gap="1" mb="2">
          <span class={monthLabel}>{label(month())}</span>
          <IconButton
            size="sm"
            variant="plain"
            aria-label="Previous month"
            onClick={() => goTo(shiftMonth(month(), -1))}
          >
            <ChevronLeftIcon size={16} />
          </IconButton>
          <Button size="sm" variant="plain" onClick={() => goTo(undefined)}>
            Today
          </Button>
          <IconButton
            size="sm"
            variant="plain"
            aria-label="Next month"
            onClick={() => goTo(shiftMonth(month(), 1))}
          >
            <ChevronRightIcon size={16} />
          </IconButton>
        </HStack>
        <CalendarMonthGrid
          weeks={weeks()}
          byDate={byDate()}
          selected={selected()}
          onSelect={setPicked}
        />
        <section aria-label="Selected day">
          <h2 class={agendaHead}>{formatLocalDate(selected())}</h2>
          <For
            each={selectedShows()}
            fallback={<p class={muted}>No shows on this day.</p>}
          >
            {(show) => <UpcomingRow show={show} />}
          </For>
        </section>
      </Show>
    </ShowsRefreshContext.Provider>
  );
}
