import type { JSX } from "solid-js";
import { Heading } from "~/components/ui/heading";
import { Box, HStack } from "styled-system/jsx";

/**
 * Sticky page header: title + count + search on one row, then a fixed-height
 * toolbar row whose content swaps between filters and bulk selection actions.
 */
export const DocsIndexHeader = (props: {
  countLabel: string;
  search: JSX.Element;
  actions: JSX.Element;
  toolbar: JSX.Element;
}) => (
  <Box
    position="sticky"
    top="0"
    zIndex="sticky"
    bg="bg.default"
    mx="-2"
    px="2"
    pt="4"
    pb="1.5"
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
);
