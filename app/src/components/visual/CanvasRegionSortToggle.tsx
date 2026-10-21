import { For, type VoidComponent } from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import type { RegionSort } from "./canvas-region-list";

const SORT_OPTIONS: Array<{ value: RegionSort; label: string; hint: string }> =
  [
    { value: "map", label: "Map", hint: "Group by island, in map order" },
    { value: "size", label: "Size", hint: "Most notes first" },
    { value: "recent", label: "Recent", hint: "Most recently edited first" },
  ];

/** Compact text toggle for the region list order. */
export const CanvasRegionSortToggle: VoidComponent<{
  value: RegionSort;
  onChange: (value: RegionSort) => void;
}> = (props) => (
  <Flex
    role="group"
    aria-label="Sort regions"
    gap="0.5"
    p="0.5"
    bg="gray.a2"
    borderRadius="l2"
  >
    <For each={SORT_OPTIONS}>
      {(option) => {
        const active = () => props.value === option.value;
        return (
          <Box
            as="button"
            title={option.hint}
            aria-pressed={active()}
            px="1.5"
            py="0.5"
            fontSize="xs"
            lineHeight="tight"
            borderRadius="l1"
            cursor="pointer"
            focusVisibleRing="inside"
            transitionProperty="background-color, color"
            transitionDuration="fast"
            color={active() ? "fg.default" : "fg.muted"}
            bg={active() ? "bg.default" : "transparent"}
            boxShadow={active() ? "xs" : "none"}
            _hover={{
              color: "fg.default",
              bg: active() ? "bg.default" : "gray.a3",
            }}
            _active={{ bg: "gray.a4" }}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </Box>
        );
      }}
    </For>
  </Flex>
);
