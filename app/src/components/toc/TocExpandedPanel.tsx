import { For, type Accessor } from "solid-js";
import { Button } from "~/components/ui/button";
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
  onItemClick: (item: TocItem) => void;
  onListRef: (el: HTMLElement | undefined) => void;
  onListScrollRef: (el: HTMLElement | undefined) => void;
  onPanelRef: (el: HTMLElement | undefined) => void;
  onListReady: () => void;
};

export function TocExpandedPanel(props: Props) {
  function getDisplayDepth(level: TocItem["level"]) {
    return Math.max(level - props.minHeadingLevel(), 0);
  }

  function getIndentStyle(depth: number) {
    if (depth <= 0) return { "margin-left": "0px", width: "100%" };
    const px = depth === 1 ? 16 : depth === 2 ? 28 : 36;
    return { "margin-left": `${px}px`, width: `calc(100% - ${px}px)` };
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
        overflowY="scroll"
        ref={(el: HTMLElement) => props.onListScrollRef(el)}
        style={{ "max-height": props.panelMaxHeightCss() }}
      >
        <Stack
          as="ul"
          gap="1"
          ref={(el: HTMLElement) => {
            props.onListRef(el);
            props.onListReady();
          }}
        >
          <For each={props.items()}>
            {(item, i) => {
              const depth = () => getDisplayDepth(item.level);
              const isActive = () => i() === props.activeIndex();

              return (
                <Box as="li" data-toc-idx={i()} style={getIndentStyle(depth())}>
                  <Button
                    type="button"
                    variant="plain"
                    size="xs"
                    colorPalette={isActive() ? "blue" : "gray"}
                    width="full"
                    justifyContent="flex-start"
                    pl="2"
                    pr="3"
                    py="1.5"
                    fontWeight={depth() <= 0 ? "semibold" : "normal"}
                    fontSize={depth() <= 1 ? "lg" : "md"}
                    borderTopWidth={i() === props.visibleStartIndex() ? "2px" : "0"}
                    borderTopColor="green.9"
                    borderBottomWidth={i() === props.visibleEndIndex() ? "2px" : "0"}
                    borderBottomColor="red.9"
                    bg={
                      i() >= props.visibleStartIndex() && i() <= props.visibleEndIndex()
                        ? "bg.subtle"
                        : "transparent"
                    }
                    _hover={{
                      bg: "bg.muted",
                      borderColor: "gray.outline.border",
                    }}
                    whiteSpace="normal"
                    textAlign="left"
                    minH="unset"
                    h="auto"
                    onClick={() => props.onItemClick(item)}
                  >
                    {item.text || item.id}
                  </Button>
                </Box>
              );
            }}
          </For>
        </Stack>
      </Box>
    </Box>
  );
}
