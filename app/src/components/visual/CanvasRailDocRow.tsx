import { Show, type VoidComponent } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, VStack } from "styled-system/jsx";
import * as HoverCard from "~/components/ui/hover-card";
import { Text } from "~/components/ui/text";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { DocItem } from "~/types/notes";
import { colorFor } from "~/utils/colors";

export type CanvasRailDocRowProps = {
  doc: DocItem;
  query: string;
  active: boolean;
  highlighted: boolean;
  onHover: (docId: string | undefined) => void;
  onOpen: (docId: string) => void;
};

/** One note in the canvas rail; hovering it spotlights the dot on the map. */
export const CanvasRailDocRow: VoidComponent<CanvasRailDocRowProps> = (props) => (
  <HoverCard.Root
    openDelay={450}
    closeDelay={60}
    positioning={{
      placement: "left-start",
      offset: { mainAxis: 12 },
      strategy: "fixed",
    }}
  >
    <HoverCard.Trigger
      asChild={(triggerProps) => (
        <Box
          {...triggerProps()}
          as="button"
          display="flex"
          alignItems="flex-start"
          gap="2"
          w="full"
          textAlign="left"
          px="2"
          py="1.5"
          borderRadius="l2"
          cursor="pointer"
          focusVisibleRing="inside"
          transitionProperty="background-color"
          transitionDuration="fast"
          bg={props.active ? "gray.a4" : props.highlighted ? "gray.a3" : "transparent"}
          _hover={{ bg: props.active ? "gray.a4" : "gray.a3" }}
          _active={{ bg: "gray.a5" }}
          aria-current={props.active ? "true" : undefined}
          onMouseEnter={() => props.onHover(props.doc.id)}
          onMouseLeave={() => props.onHover(undefined)}
          onFocus={() => props.onHover(props.doc.id)}
          onBlur={() => props.onHover(undefined)}
          onClick={() => props.onOpen(props.doc.id)}
        >
          <Box
            flexShrink="0"
            mt="1.5"
            boxSize="2"
            borderRadius="full"
            style={{ background: colorFor(props.doc.path || props.doc.title) }}
          />
          <Text
            fontSize="sm"
            lineHeight="snug"
            lineClamp="2"
            fontWeight={props.active ? "medium" : "normal"}
            minW="0"
          >
            {renderHighlighted(props.doc.title, props.query)}
          </Text>
        </Box>
      )}
    />
    <Portal>
      <HoverCard.Positioner>
        <HoverCard.Content maxW="20rem" zIndex="popover" p="3">
          <VStack alignItems="stretch" gap="1">
            <Text fontSize="sm" fontWeight="semibold">
              {props.doc.title}
            </Text>
            <Show when={props.doc.path}>
              <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">
                {renderHighlighted(props.doc.path ?? "", props.query)}
              </Text>
            </Show>
            <Text fontSize="xs" color="fg.muted">
              Updated {formatRelativeTime(props.doc.updatedAt)}
            </Text>
          </VStack>
        </HoverCard.Content>
      </HoverCard.Positioner>
    </Portal>
  </HoverCard.Root>
);
