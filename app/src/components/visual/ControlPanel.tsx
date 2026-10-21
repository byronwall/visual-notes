import { CheckIcon, SearchIcon, XIcon } from "lucide-solid";
import {
  Show,
  createEffect,
  createSignal,
  onCleanup,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { InputGroup } from "~/components/ui/input-group";
import { Kbd } from "~/components/ui/kbd";
import {
  canvasMatchCountLabel,
  canvasSearchPlaceholder,
} from "./canvas-search";

export type ControlPanelProps = {
  searchQuery: Accessor<string>;
  setSearchQuery: (value: string) => void;
  matchCount: Accessor<number>;
  /** Title of the open region, or null when no region is open. */
  regionTitle: Accessor<string | null>;
  /** True when matches are limited to the open region. */
  scopedToRegion: Accessor<boolean>;
  onToggleRegionScope: () => void;
  onSubmitSearch: () => void;
  inputRef?: (el: HTMLInputElement) => void;
};

/** Floating search for the canvas; matches light up on the map and in the rail. */
export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
  const scopeTitle = () =>
    props.scopedToRegion() ? props.regionTitle() : null;
  const hasQuery = () => props.searchQuery().trim().length > 0;
  // The count + clear group grows with the numbers, so the input reserves
  // exactly that much room and typed text never runs underneath it.
  const [endWidth, setEndWidth] = createSignal(0);
  const observeEndGroup = (el: HTMLDivElement) => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setEndWidth(el.offsetWidth));
    observer.observe(el);
    onCleanup(() => {
      observer.disconnect();
      setEndWidth(0);
    });
  };
  let input: HTMLInputElement | undefined;
  createEffect(() => {
    const width = hasQuery() ? endWidth() : 0;
    // InputGroup pins input padding with !important, so match its priority.
    if (width)
      input?.style.setProperty(
        "padding-inline-end",
        `${width + 16}px`,
        "important",
      );
    else input?.style.removeProperty("padding-inline-end");
  });

  return (
    <Box
      bg="bg.default"
      borderRadius="l2"
      boxShadow="md"
      w="min(22rem, calc(100vw - 6rem))"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <InputGroup
        size="sm"
        startElement={<SearchIcon />}
        endElement={
          <Show
            when={hasQuery()}
            fallback={
              <Kbd size="sm" display={{ base: "none", md: "inline-flex" }}>
                /
              </Kbd>
            }
          >
            <Flex
              ref={observeEndGroup}
              align="center"
              gap="1"
              pointerEvents="auto"
            >
              <Box
                fontSize="xs"
                color={props.matchCount() === 0 ? "error" : "fg.muted"}
                fontVariantNumeric="tabular-nums"
                whiteSpace="nowrap"
              >
                {canvasMatchCountLabel(
                  props.matchCount(),
                  props.scopedToRegion(),
                )}
              </Box>
              <Box
                as="button"
                aria-label="Clear search"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                boxSize="5"
                borderRadius="l1"
                color="fg.muted"
                cursor="pointer"
                focusVisibleRing="outside"
                transitionProperty="background-color, color"
                transitionDuration="fast"
                _hover={{ bg: "gray.a3", color: "fg.default" }}
                onClick={() => props.setSearchQuery("")}
              >
                <XIcon size={14} />
              </Box>
            </Flex>
          </Show>
        }
      >
        <Input
          ref={(el: HTMLInputElement) => {
            input = el;
            props.inputRef?.(el);
          }}
          type="search"
          aria-label={
            scopeTitle()
              ? `Search notes in ${scopeTitle()}`
              : "Search notes on the canvas"
          }
          placeholder={canvasSearchPlaceholder(scopeTitle())}
          borderColor="transparent"
          value={props.searchQuery()}
          onInput={(event) => props.setSearchQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              props.onSubmitSearch();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (hasQuery()) props.setSearchQuery("");
              else event.currentTarget.blur();
            }
          }}
        />
      </InputGroup>
      <Show when={props.regionTitle()}>
        {(title) => (
          <RegionScopeChip
            title={title()}
            active={props.scopedToRegion()}
            onToggle={props.onToggleRegionScope}
          />
        )}
      </Show>
    </Box>
  );
};

/** Toggle under the search field: on limits matches to the open region. */
const RegionScopeChip: VoidComponent<{
  title: string;
  active: boolean;
  onToggle: () => void;
}> = (props) => (
  <Flex px="2" pb="2" pt="0.5">
    <Box
      as="button"
      aria-pressed={props.active}
      title={
        props.active ? "Search all notes instead" : `Only search ${props.title}`
      }
      display="inline-flex"
      alignItems="center"
      gap="1"
      maxW="full"
      h="6"
      px="2"
      borderRadius="full"
      borderWidth="1px"
      fontSize="xs"
      cursor="pointer"
      focusVisibleRing="outside"
      transitionProperty="background-color, border-color, color"
      transitionDuration="fast"
      borderColor={props.active ? "blue.a7" : "border"}
      bg={props.active ? "blue.a3" : "transparent"}
      color={props.active ? "blue.11" : "fg.muted"}
      _hover={
        props.active
          ? { bg: "blue.a4" }
          : { bg: "gray.a3", color: "fg.default" }
      }
      onClick={() => props.onToggle()}
    >
      <Show when={props.active}>
        <CheckIcon size={12} />
      </Show>
      <Box as="span" flexShrink="0">
        In:
      </Box>
      <Box as="span" truncate fontWeight="medium">
        {props.title}
      </Box>
      <Show when={props.active}>
        <XIcon size={12} />
      </Show>
    </Box>
  </Flex>
);
