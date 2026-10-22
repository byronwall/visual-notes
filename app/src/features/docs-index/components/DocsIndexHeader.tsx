import { createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { Heading } from "~/components/ui/heading";
import { Box, HStack } from "styled-system/jsx";

export const HEADER_HEIGHT_VAR = "--docs-index-header-h";

/**
 * Sticky page header: title + count + search on one row, then a fixed-height
 * toolbar row whose content swaps between filters and bulk selection actions.
 */
export const DocsIndexHeader = (props: {
  countLabel: string;
  search: JSX.Element;
  actions: JSX.Element;
  toolbar: JSX.Element;
}) => {
  // Show a hairline under the header only once content scrolls beneath it.
  const [stuck, setStuck] = createSignal(false);
  let sentinel: HTMLDivElement | undefined;
  let bar: HTMLDivElement | undefined;
  onMount(() => {
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(!entry.isIntersecting),
    );
    observer.observe(sentinel);
    onCleanup(() => observer.disconnect());
  });
  // Date headings stick just below this bar; publish its height to them.
  onMount(() => {
    const host = bar?.parentElement;
    if (!bar || !host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      host.style.setProperty(HEADER_HEIGHT_VAR, `${bar!.offsetHeight}px`),
    );
    observer.observe(bar);
    onCleanup(() => observer.disconnect());
  });

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <Box
        ref={bar}
        position="sticky"
        top="0"
        zIndex="sticky"
        bg="bg.default"
        mx="-2"
        px="2"
        pt="4"
        pb="1.5"
        transitionProperty="box-shadow"
        transitionDuration="160ms"
        style={{
          "box-shadow": stuck() ? "0 1px 0 var(--colors-gray-a4)" : "none",
        }}
      >
        <HStack gap="3" alignItems="center">
          <HStack
            gap="2"
            alignItems="baseline"
            flexShrink="0"
            smDown={{ display: "none" }}
          >
            <Heading as="h1" fontSize="xl" lineHeight="1">
              Notes
            </Heading>
            <Box
              fontSize="sm"
              color="fg.subtle"
              fontVariantNumeric="tabular-nums"
              minW="5rem"
            >
              {props.countLabel}
            </Box>
          </HStack>
          {props.search}
          {props.actions}
        </HStack>
        <HStack gap="1.5" h="9" mt="1.5" minW="0" overflowX="clip">
          {props.toolbar}
        </HStack>
      </Box>
    </>
  );
};
