import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
} from "solid-js";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Box, Stack } from "styled-system/jsx";
import { type TocItem } from "./types";

type Props = {
  items: Accessor<TocItem[]>;
  panelWidthPx: Accessor<number>;
  panelMaxHeightCss: Accessor<string>;
  minHeadingLevel: Accessor<1 | 2 | 3 | 4 | 5 | 6>;
  activeIndex: Accessor<number>;
  visibleStartIndex: Accessor<number>;
  visibleEndIndex: Accessor<number>;
  showExpandedPanel: Accessor<boolean>;
  onItemClick: (item: TocItem) => void;
  onListRef: (el: HTMLElement | undefined) => void;
  onListScrollRef: (el: HTMLElement | undefined) => void;
  onPanelRef: (el: HTMLElement | undefined) => void;
  onListReady: () => void;
};

export function TocExpandedPanel(props: Props) {
  const [search, setSearch] = createSignal("");
  const [lockedPanelHeightPx, setLockedPanelHeightPx] = createSignal<number | undefined>(
    undefined
  );
  let searchRef: HTMLInputElement | undefined;
  let navRef: HTMLDivElement | undefined;

  const filteredItems = createMemo(() => {
    const query = search().trim().toLowerCase();
    return props
      .items()
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!query) return true;
        return item.text.toLowerCase().includes(query);
      });
  });

  function getDisplayDepth(level: TocItem["level"]) {
    return Math.max(level - props.minHeadingLevel(), 0);
  }

  function getItemPaddingLeftPx(depth: number) {
    return 10 + depth * 14;
  }

  createEffect(() => {
    props.showExpandedPanel();
    if (!props.showExpandedPanel()) return;
    window.requestAnimationFrame(() => searchRef?.focus());
  });

  function handleSearchInput(value: string) {
    const wasSearching = search().trim().length > 0;
    const willSearch = value.trim().length > 0;

    if (!wasSearching && willSearch) {
      const height = navRef?.getBoundingClientRect().height;
      setLockedPanelHeightPx(height ? Math.round(height) : undefined);
    }

    if (wasSearching && !willSearch) {
      setLockedPanelHeightPx(undefined);
    }

    setSearch(value);
  }

  return (
    <Box
      ref={(el: HTMLElement) => props.onPanelRef(el)}
      borderWidth="1px"
      borderColor="gray.outline.border"
      bg="bg.default"
      borderRadius="l2"
      boxShadow="lg"
      overflow="hidden"
      style={{
        width: `${props.panelWidthPx()}px`,
        "max-width": "min(320px, calc(100vw - 1rem))",
      }}
    >
      <Box
        as="nav"
        p="2"
        ref={navRef}
        style={{
          height: lockedPanelHeightPx() ? `${lockedPanelHeightPx()}px` : undefined,
          "max-height": props.panelMaxHeightCss(),
          display: "grid",
          "grid-template-rows": "auto minmax(0, 1fr)",
          gap: "8px",
        }}
      >
        <Input
          type="search"
          placeholder="Search headings"
          value={search()}
          onInput={(event) => handleSearchInput(event.currentTarget.value)}
          size="sm"
          ref={searchRef}
        />

        <Stack
          as="ul"
          gap="1"
          overflowY="auto"
          position="relative"
          pl="2"
          ref={(el: HTMLElement) => {
            props.onListRef(el);
            props.onListScrollRef(el);
            props.onListReady();
          }}
        >
          <For each={filteredItems()}>
            {({ item, index }) => {
              const depth = () => getDisplayDepth(item.level);
              const isActive = () => index === props.activeIndex();
              const isVisible = () =>
                index >= props.visibleStartIndex() && index <= props.visibleEndIndex();

              return (
                <Box as="li" data-toc-idx={index} position="relative" minH="8">
                  <Button
                    type="button"
                    variant="plain"
                    size="xs"
                    width="full"
                    justifyContent="flex-start"
                    pr="3"
                    py="1.5"
                    fontWeight={depth() <= 0 ? "semibold" : "normal"}
                    fontSize={depth() <= 1 ? "sm" : "xs"}
                    borderRadius="sm"
                    bg={isActive() ? "bg.muted" : isVisible() ? "bg.subtle" : "transparent"}
                    _hover={{
                      bg: "bg.muted",
                    }}
                    whiteSpace="normal"
                    textAlign="left"
                    minH="unset"
                    h="auto"
                    onClick={() => props.onItemClick(item)}
                    style={{
                      "padding-left": `${getItemPaddingLeftPx(depth())}px`,
                    }}
                  >
                    {item.text || item.id}
                  </Button>
                </Box>
              );
            }}
          </For>
          <Show when={filteredItems().length === 0}>
            <Box as="li" px="2" py="2" fontSize="xs" color="fg.muted">
              No headings found
            </Box>
          </Show>
        </Stack>
      </Box>
    </Box>
  );
}
