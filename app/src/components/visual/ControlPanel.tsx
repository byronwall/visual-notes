import { SearchIcon, XIcon } from "lucide-solid";
import { Show, type Accessor, type VoidComponent } from "solid-js";
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
            <Flex align="center" gap="1" pointerEvents="auto">
              <Box
                fontSize="xs"
                color={props.matchCount() === 0 ? "fg.error" : "fg.muted"}
                fontVariantNumeric="tabular-nums"
                whiteSpace="nowrap"
              >
                {props.matchCount()} of {props.totalCount()}
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
                transitionProperty="background-color, color"
                transitionDuration="fast"
                _hover={{ bg: "bg.muted", color: "fg.default" }}
                onClick={() => props.setSearchQuery("")}
              >
                <XIcon size={14} />
              </Box>
            </Flex>
          </Show>
        }
      >
        <Input
          ref={props.inputRef}
          type="search"
          aria-label="Search notes on the canvas"
          placeholder="Search notes"
          borderColor="transparent"
          pe={hasQuery() ? "24" : "8"}
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
