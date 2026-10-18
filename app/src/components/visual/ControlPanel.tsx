import { SearchIcon, XIcon } from "lucide-solid";
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

export type ControlPanelProps = {
  searchQuery: Accessor<string>;
  setSearchQuery: (value: string) => void;
  matchCount: Accessor<number>;
  totalCount: Accessor<number>;
  onSubmitSearch: () => void;
  inputRef?: (el: HTMLInputElement) => void;
};

/** Floating search for the canvas; matches light up on the map and in the rail. */
export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
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
    if (width) input?.style.setProperty("padding-inline-end", `${width + 16}px`, "important");
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
            <Flex ref={observeEndGroup} align="center" gap="1" pointerEvents="auto">
              <Box
                fontSize="xs"
                color={props.matchCount() === 0 ? "error" : "fg.muted"}
                fontVariantNumeric="tabular-nums"
                whiteSpace="nowrap"
              >
                {props.matchCount().toLocaleString()} of{" "}
                {props.totalCount().toLocaleString()}
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
          aria-label="Search notes on the canvas"
          placeholder="Search notes"
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
    </Box>
  );
};
