import { A, useNavigate } from "@solidjs/router";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-solid";
import { For } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import * as Menu from "~/components/ui/menu";
import type { ArchivedPageGroupSummary } from "~/services/archive/archive.types";

const crumbLinkClass = css({
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  px: "1",
  mx: "-1",
  whiteSpace: "nowrap",
  transitionProperty: "color",
  transitionDuration: "fast",
  _hover: { color: "fg.default" },
});

export const archiveGroupCanvasHref = (group: string) =>
  `/archive/groups/${encodeURIComponent(group)}/canvas`;

/** "Explorer › Canvases › Group ▾" — the group menu jumps between canvases. */
export const ArchiveCanvasBreadcrumb = (props: {
  groupName: string;
  groups: ArchivedPageGroupSummary[];
}) => {
  const navigate = useNavigate();

  return (
    <HStack gap="1.5" minW="0" as="nav" aria-label="Breadcrumb">
      <A href="/archive" class={crumbLinkClass}>
        Explorer
      </A>
      <Box color="fg.subtle" display="flex" flexShrink="0">
        <ChevronRightIcon size={14} />
      </Box>
      <A href="/archive/canvas" class={crumbLinkClass}>
        Canvases
      </A>
      <Box color="fg.subtle" display="flex" flexShrink="0">
        <ChevronRightIcon size={14} />
      </Box>
      <Menu.Root
        positioning={{ placement: "bottom-start", gutter: 4 }}
        onSelect={(details) => navigate(archiveGroupCanvasHref(details.value))}
      >
        <Menu.Trigger
          display="inline-flex"
          alignItems="center"
          gap="1"
          minW="0"
          px="1.5"
          mx="-1.5"
          py="0.5"
          borderRadius="l2"
          fontSize={{ base: "md", md: "lg" }}
          fontWeight="semibold"
          cursor="pointer"
          transitionProperty="background-color"
          transitionDuration="fast"
          _hover={{ bg: "gray.a3" }}
          _expanded={{ bg: "gray.a3" }}
        >
          <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {props.groupName}
          </Box>
          <Box as="span" color="fg.subtle" display="flex" flexShrink="0">
            <ChevronDownIcon size={15} />
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner zIndex="popover">
            <Menu.Content minW="12rem" maxH="min(24rem, 70vh)" overflowY="auto">
              <For each={props.groups}>
                {(group) => (
                  <Menu.Item value={group.name} justifyContent="space-between" gap="4">
                    <span
                      class={css({
                        fontWeight: group.name === props.groupName ? "semibold" : "normal",
                      })}
                    >
                      {group.name}
                    </span>
                    <span class={css({ fontSize: "xs", color: "fg.subtle" })}>{group.count}</span>
                  </Menu.Item>
                )}
              </For>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  );
};
