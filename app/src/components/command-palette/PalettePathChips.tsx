import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { RouteIcon } from "lucide-solid";
import { css, cx } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { PathPillLink } from "~/components/path/PathPillLink";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { pathToRoute } from "~/utils/path-links";

type PathMatch = { path: string; count: number };

type PalettePathChipsProps = {
  paths: PathMatch[];
  query: string;
  onPick: (ev: MouseEvent, path: string) => void;
};

const ROW_HEIGHT = "2.25rem";

// One row tall: chips that wrap past it are clipped whole and hidden, and the
// "+N" button lists them, so the row never scrolls or cuts a chip in half.
const chipRowClass = css({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  columnGap: "1.5",
  rowGap: "2",
  flex: "1",
  minW: "0",
  h: ROW_HEIGHT,
  py: "1",
  overflow: "hidden",
});
const chipClass = css({ maxW: "full", minW: "0", whiteSpace: "nowrap" });
const hiddenChipClass = css({ visibility: "hidden" });
const chipLabelClass = css({ overflow: "hidden", textOverflow: "ellipsis" });
const moreButtonClass = css({
  flexShrink: "0",
  px: "2",
  py: "1",
  borderRadius: "l2",
  fontSize: "xs",
  fontFamily: "mono",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a2", color: "fg.default" },
  _focusVisible: { outline: "2px solid", outlineColor: "gray.a8" },
});

const PathChip = (props: {
  item: PathMatch;
  query: string;
  hidden?: boolean;
  onPick: (ev: MouseEvent, path: string) => void;
}) => (
  <PathPillLink
    href={pathToRoute(props.item.path)}
    variant="subtle"
    class={cx(chipClass, props.hidden && hiddenChipClass)}
    onClick={(e) => props.onPick(e as unknown as MouseEvent, props.item.path)}
  >
    <span class={chipLabelClass}>
      {renderHighlighted(props.item.path, props.query)}{" "}
      <Text as="span" color="fg.muted">
        ({props.item.count})
      </Text>
    </span>
  </PathPillLink>
);

export const PalettePathChips = (props: PalettePathChipsProps) => {
  const [hiddenFrom, setHiddenFrom] = createSignal<number | null>(null);
  const [moreOpen, setMoreOpen] = createSignal(false);
  let wrapEl: HTMLDivElement | undefined;
  let rowEl: HTMLDivElement | undefined;

  // Index of the first chip that wrapped to a second line. Showing "+N"
  // narrows the row, so measure again until the split stops moving; all of
  // this runs before paint, so the row never flashes a clipped chip.
  const measure = () => {
    if (!rowEl) return;
    for (let pass = 0; pass < 3; pass++) {
      const chips = Array.from(rowEl.children) as HTMLElement[];
      const top = chips[0]?.offsetTop ?? 0;
      const index = chips.findIndex((chip) => chip.offsetTop > top);
      const next = index === -1 ? null : index;
      if (next === hiddenFrom()) return;
      setHiddenFrom(next);
    }
  };

  createEffect(() => {
    void props.paths;
    void props.query;
    measure();
  });

  onMount(() => {
    // Observe the wrapper, whose width the "+N" button doesn't change, so
    // re-measuring never triggers a ResizeObserver loop.
    const observer = new ResizeObserver(() => measure());
    if (wrapEl) observer.observe(wrapEl);
    onCleanup(() => observer.disconnect());
  });

  const overflow = () => {
    const from = hiddenFrom();
    return from === null ? [] : props.paths.slice(from);
  };
  const isHidden = (index: number) => {
    const from = hiddenFrom();
    return from !== null && index >= from;
  };

  return (
    <HStack ref={wrapEl} gap="2" alignItems="center" minW="0" h={ROW_HEIGHT}>
      <RouteIcon size={14} class={css({ color: "fg.muted", flexShrink: "0" })} />
      <Show
        when={props.paths.length > 0}
        fallback={
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
            No matching paths
          </Text>
        }
      >
        <Box ref={rowEl} class={chipRowClass} data-palette-paths>
          <For each={props.paths}>
            {(item, index) => (
              <PathChip
                item={item}
                query={props.query}
                hidden={isHidden(index())}
                onPick={props.onPick}
              />
            )}
          </For>
        </Box>
        <Show when={overflow().length > 0}>
          <SimplePopover
            open={moreOpen()}
            onClose={() => setMoreOpen(false)}
            placement="bottom-end"
            offset={4}
            anchor={
              <button
                type="button"
                class={moreButtonClass}
                aria-label={`${overflow().length} more paths`}
                aria-expanded={moreOpen()}
                onClick={() => setMoreOpen((open) => !open)}
              >
                +{overflow().length}
              </button>
            }
          >
            <Stack gap="0.5" p="1" maxW="20rem">
              <For each={overflow()}>
                {(item) => (
                  <PathChip item={item} query={props.query} onPick={props.onPick} />
                )}
              </For>
            </Stack>
          </SimplePopover>
        </Show>
      </Show>
    </HStack>
  );
};
