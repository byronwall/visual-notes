import { SearchIcon } from "lucide-solid";
import {
  Show,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import * as Switch from "~/components/ui/switch";
import { PAST_DAYS, hasActiveFilters } from "~/lib/events/filters";
import { fetchCollections } from "~/services/collections/collections.queries";
import { DecisionFilterMenu } from "./DecisionFilterMenu";
import type { EventsFiltersApi } from "./useEventsFilters";

const searchWrap = css({
  position: "relative",
  flex: "1 1 12rem",
  minW: "0",
  maxW: { md: "18rem" },
  "& svg": {
    position: "absolute",
    left: "2",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.subtle",
    pointerEvents: "none",
  },
});
const clearBtn = css({
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  px: "1.5",
  h: "8",
  borderRadius: "l2",
  _hover: { color: "fg.default", bg: "bg.muted" },
});

/** Compact filter row shared by the Upcoming list and the calendar. */
export function EventsFilterBar(props: {
  api: EventsFiltersApi;
  /** Hide the past toggle where the date window is fixed (calendar). */
  hidePast?: boolean;
  children?: JSX.Element;
}) {
  const [collections] = createResource(() => fetchCollections());
  const filters = () => props.api.filters();
  const items = createMemo(() => [
    { label: "All notes", value: "all" },
    ...(collections.latest ?? []).map((c) => ({ label: c.name, value: c.id })),
    { label: "Loose notes", value: "loose" },
  ]);

  const [draft, setDraft] = createSignal(filters().q);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onSearch = (value: string) => {
    setDraft(value);
    clearTimeout(timer);
    timer = setTimeout(() => props.api.update({ q: value }), 250);
  };
  onCleanup(() => clearTimeout(timer));

  return (
    <HStack gap="2" flexWrap="wrap" mb="4" alignItems="center">
      <Box w="11rem" flexShrink="0">
        <SimpleSelect
          items={items()}
          value={filters().collection}
          onChange={(value) => props.api.update({ collection: value || "all" })}
          size="sm"
          minW="10rem"
          sameWidth={false}
          skipPortal={false}
        />
      </Box>
      <DecisionFilterMenu
        selected={filters().decisions}
        onChange={(decisions) => props.api.update({ decisions })}
      />
      <Show when={!props.hidePast}>
        <Switch.Root
          size="sm"
          checked={filters().past}
          onCheckedChange={(d) =>
            props.api.update({ past: Boolean(d.checked) })
          }
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm" color="fg.muted" whiteSpace="nowrap">
            Past {PAST_DAYS} days
          </Switch.Label>
        </Switch.Root>
      </Show>
      <div class={searchWrap}>
        <SearchIcon size={14} />
        <Input
          size="sm"
          ps="7"
          type="search"
          placeholder="Search titles"
          aria-label="Search event titles"
          value={draft()}
          onInput={(e) => onSearch(e.currentTarget.value)}
        />
      </div>
      <Show when={hasActiveFilters(filters())}>
        <button
          type="button"
          class={clearBtn}
          onClick={() => {
            setDraft("");
            props.api.clear();
          }}
        >
          Clear
        </button>
      </Show>
      {props.children}
    </HStack>
  );
}
