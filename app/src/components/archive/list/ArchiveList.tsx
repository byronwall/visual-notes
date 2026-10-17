import { For, Match, Switch, onCleanup, onMount } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import type { ArchivedPageListItem } from "~/services/archive/archive.types";
import { ARCHIVE_LIST_COLUMNS, ArchiveListRow } from "./ArchiveListRow";

export type ArchiveListProps = {
  items: ArchivedPageListItem[];
  loaded: boolean;
  isFiltered: boolean;
  selectedId?: string;
  groupOptions: string[];
  onSelect: (id: string | undefined) => void;
  onFilterHost: (hostname: string) => void;
  onGroupCommit: (id: string, groupName: string) => Promise<void>;
  onDelete: (id: string) => void;
  onClearFilters: () => void;
  onFocusSearch: () => void;
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const ArchiveList = (props: ArchiveListProps) => {
  const move = (delta: number) => {
    const list = props.items;
    if (!list.length) return;
    const index = list.findIndex((item) => item.id === props.selectedId);
    const nextIndex =
      index < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + delta));
    const next = list[nextIndex];
    if (!next) return;
    props.onSelect(next.id);
    queueMicrotask(() =>
      document
        .querySelector(`[data-archive-row="${CSS.escape(next.id)}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  };

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "/") {
        event.preventDefault();
        props.onFocusSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Box mt="3" role="table" aria-label="Captured pages">
      <Box
        role="row"
        display={{ base: "none", md: "grid" }}
        gridTemplateColumns={ARCHIVE_LIST_COLUMNS}
        columnGap="3"
        px="3"
        pb="1.5"
        fontSize="xs"
        color="fg.subtle"
      >
        <span role="columnheader" />
        <span role="columnheader">Page</span>
        <span role="columnheader">Group</span>
        <span role="columnheader" style={{ "text-align": "right" }}>
          Captured
        </span>
        <span role="columnheader" />
      </Box>

      <Switch>
        <Match when={props.items.length > 0}>
          <Stack gap="0.5" role="rowgroup">
            <For each={props.items}>
              {(item) => (
                <ArchiveListRow
                  item={item}
                  selected={props.selectedId === item.id}
                  groupOptions={props.groupOptions}
                  onOpen={() => props.onSelect(item.id)}
                  onFilterHost={props.onFilterHost}
                  onGroupCommit={(groupName) => props.onGroupCommit(item.id, groupName)}
                  onDelete={() => props.onDelete(item.id)}
                />
              )}
            </For>
          </Stack>
        </Match>
        <Match when={!props.loaded}>
          <Stack gap="0.5">
            <For each={Array.from({ length: 6 })}>
              {() => (
                <Box
                  display="grid"
                  gridTemplateColumns={ARCHIVE_LIST_COLUMNS}
                  columnGap="3"
                  alignItems="center"
                  px={{ base: "2", md: "3" }}
                  py="2"
                >
                  <Box aspectRatio="16 / 10" borderRadius="l2" bg="bg.subtle" />
                  <Stack gap="1.5">
                    <Box h="3.5" w="60%" borderRadius="l1" bg="bg.subtle" />
                    <Box h="3" w="40%" borderRadius="l1" bg="bg.subtle" />
                  </Stack>
                </Box>
              )}
            </For>
          </Stack>
        </Match>
        <Match when={props.isFiltered}>
          <Stack gap="2" alignItems="flex-start" px="3" py="8">
            <Text fontWeight="medium">No pages match these filters</Text>
            <Button type="button" variant="outline" size="sm" onClick={props.onClearFilters}>
              Clear filters
            </Button>
          </Stack>
        </Match>
        <Match when={true}>
          <Stack gap="1" px="3" py="8" maxW="32rem">
            <Text fontWeight="medium">No captured pages yet</Text>
            <Text fontSize="sm" color="fg.muted">
              Pages you save with the Visual Notes browser extension show up here with their notes
              and snapshot history.
            </Text>
          </Stack>
        </Match>
      </Switch>
    </Box>
  );
};
