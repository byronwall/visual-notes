import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { ArchivedPageCanvasOverviewGroup } from "~/services/archive/archive.types";
import { archiveGroupCanvasHref } from "./ArchiveCanvasBreadcrumb";

const tileClass = css({
  display: "flex",
  flexDirection: "column",
  minW: "0",
  gap: "3",
  p: "3",
  borderRadius: "l3",
  bg: "bg.subtle",
  color: "fg.default",
  textDecoration: "none",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "fast",
  _hover: { bg: "gray.a3" },
  _focusVisible: { outline: "2px solid", outlineColor: "colorPalette.default", outlineOffset: "2px" },
});

/** One group on the canvases overview; the whole tile opens that group's canvas. */
export const ArchiveGroupTile = (props: { group: ArchivedPageCanvasOverviewGroup }) => (
  <A href={archiveGroupCanvasHref(props.group.name)} class={tileClass}>
    <Box
      display={props.group.previewImages.length ? "grid" : "none"}
      gridTemplateColumns="repeat(3, minmax(0, 1fr))"
      gap="1.5"
      aspectRatio="3 / 1"
    >
      <For each={[0, 1, 2]}>
        {(index) => (
          <Box
            borderRadius="l2"
            overflow="hidden"
            bg="bg.default"
            boxShadow="inset 0 0 0 1px var(--colors-gray-a3)"
          >
            <Show when={props.group.previewImages[index]}>
              {(src) => (
                <img
                  src={src()}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", "object-fit": "cover", display: "block" }}
                />
              )}
            </Show>
          </Box>
        )}
      </For>
    </Box>

    <HStack justify="space-between" alignItems="baseline" gap="3" minW="0">
      <Text fontWeight="semibold" truncate>
        {props.group.name}
      </Text>
      <Text fontSize="xs" color="fg.muted" flexShrink="0" fontVariantNumeric="tabular-nums">
        {props.group.count} {props.group.count === 1 ? "page" : "pages"}
        <Show when={props.group.latestUpdatedAt}>
          {(updated) => <> · {formatRelativeTime(updated())}</>}
        </Show>
      </Text>
    </HStack>

    <Box display="flex" flexDirection="column" gap="1" fontSize="sm" color="fg.muted">
      <For each={props.group.sampleTitles}>
        {(title) => (
          <Text fontSize="sm" color="fg.muted" truncate>
            {title}
          </Text>
        )}
      </For>
    </Box>
  </A>
);
