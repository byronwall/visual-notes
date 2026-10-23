import { A } from "@solidjs/router";
import { LayoutGridIcon, SearchIcon, XIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Text } from "~/components/ui/text";
import type { ArchivedPageGroupSummary } from "~/services/archive/archive.types";
import { CAPTURED_SINCE_OPTIONS, UNGROUPED_FILTER } from "./archive-list-filters";

const RouterButtonLink = styled(A, button);

const groupTabClass = css({
  display: "inline-flex",
  alignItems: "baseline",
  gap: "1.5",
  px: "2.5",
  py: "1",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.muted",
  whiteSpace: "nowrap",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a3", color: "fg.default" },
  _focusVisible: { outline: "2px solid", outlineColor: "colorPalette.default", outlineOffset: "1px" },
  "&[aria-current=page]": { bg: "bg.selected", color: "fg.selected", fontWeight: "medium" },
});

const countClass = css({ fontSize: "xs", color: "fg.subtle", fontVariantNumeric: "tabular-nums" });

export type ArchiveListToolbarProps = {
  group: string;
  groups: ArchivedPageGroupSummary[];
  totals?: { total: number; ungrouped: number };
  totalCount: number;
  search: string;
  since: string;
  hostname: string;
  hasCustomRange: boolean;
  groupHref: (group: string) => string;
  onSearch: (value: string) => void;
  onSince: (value: string) => void;
  onClearHostname: () => void;
  onClearCustomRange: () => void;
  searchRef?: (element: HTMLInputElement) => void;
};

export const ArchiveListToolbar = (props: ArchiveListToolbarProps) => {
  const canvasGroup = () => (props.group && props.group !== UNGROUPED_FILTER ? props.group : "");

  return (
    <Box display="flex" flexDirection="column" gap="2.5">
      <HStack gap="3" flexWrap="wrap" justify="space-between" alignItems="center">
        <HStack gap="2" alignItems="baseline" minW="0">
          <Text as="h1" fontSize={{ base: "xl", md: "2xl" }} fontWeight="semibold">
            Explorer
          </Text>
          <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
            {props.totalCount} {props.totalCount === 1 ? "page" : "pages"}
          </Text>
        </HStack>

        <HStack gap="2" flex={{ base: "1 1 100%", md: "0 1 auto" }} minW="0">
          <Box position="relative" flex="1" minW={{ base: "0", md: "18rem" }}>
            <Box
              position="absolute"
              left="2.5"
              top="50%"
              transform="translateY(-50%)"
              color="fg.subtle"
              pointerEvents="none"
              display="flex"
            >
              <SearchIcon size={15} />
            </Box>
            <Input
              ref={props.searchRef}
              size="sm"
              type="search"
              pl="8"
              value={props.search}
              placeholder="Search title, URL, description"
              aria-label="Search explorer"
              onInput={(event) => props.onSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && props.search) {
                  event.preventDefault();
                  props.onSearch("");
                }
              }}
            />
          </Box>
          <Box flexShrink="0">
            <SimpleSelect
              size="sm"
              items={CAPTURED_SINCE_OPTIONS}
              value={props.since}
              onChange={props.onSince}
              placeholder="Any time"
              sameWidth={false}
              minW="8.5rem"
            />
          </Box>
          <RouterButtonLink
            href={
              canvasGroup()
                ? `/archive/groups/${encodeURIComponent(canvasGroup())}/canvas`
                : "/archive/canvas"
            }
            variant="outline"
            size="sm"
            flexShrink="0"
            title={canvasGroup() ? `Open ${canvasGroup()} canvas` : "All group canvases"}
          >
            <LayoutGridIcon size={15} />
            <Box as="span" hideBelow="sm">
              Canvas
            </Box>
          </RouterButtonLink>
        </HStack>
      </HStack>

      <HStack gap="1" flexWrap="wrap" alignItems="center" as="nav" aria-label="Explorer groups" ml="-2.5">
        <a href={props.groupHref("")} class={groupTabClass} aria-current={!props.group ? "page" : undefined}>
          All
          <Show when={props.totals}>{(totals) => <span class={countClass}>{totals().total}</span>}</Show>
        </a>
        <For each={props.groups}>
          {(group) => (
            <a
              href={props.groupHref(group.name)}
              class={groupTabClass}
              aria-current={props.group === group.name ? "page" : undefined}
            >
              {group.name}
              <span class={countClass}>{group.count}</span>
            </a>
          )}
        </For>
        <Show when={props.group === UNGROUPED_FILTER || (props.totals?.ungrouped ?? 0) > 0}>
        <a
          href={props.groupHref(UNGROUPED_FILTER)}
          class={groupTabClass}
          aria-current={props.group === UNGROUPED_FILTER ? "page" : undefined}
        >
          Ungrouped
          <Show when={props.totals}>{(totals) => <span class={countClass}>{totals().ungrouped}</span>}</Show>
        </a>
        </Show>

        <Show when={props.hostname}>
          <FilterChip label="Host" value={props.hostname} mono onClear={props.onClearHostname} />
        </Show>
        <Show when={props.hasCustomRange}>
          <FilterChip label="Captured" value="custom range" onClear={props.onClearCustomRange} />
        </Show>
      </HStack>
    </Box>
  );
};

const FilterChip = (props: { label: string; value: string; mono?: boolean; onClear: () => void }) => (
  <HStack
    gap="1"
    ml="1"
    pl="2.5"
    pr="1"
    py="0.5"
    borderRadius="l2"
    bg="colorPalette.subtle.bg"
    colorPalette="blue"
    fontSize="sm"
  >
    <Text as="span" color="fg.muted" fontSize="xs">
      {props.label}
    </Text>
    <Text as="span" fontFamily={props.mono ? "mono" : undefined} fontSize="sm">
      {props.value}
    </Text>
    <button
      type="button"
      aria-label={`Clear ${props.label.toLowerCase()} filter`}
      class={css({
        display: "inline-flex",
        p: "0.5",
        borderRadius: "l1",
        color: "fg.muted",
        cursor: "pointer",
        _hover: { bg: "gray.a4", color: "fg.default" },
      })}
      onClick={props.onClear}
    >
      <XIcon size={13} />
    </button>
  </HStack>
);
