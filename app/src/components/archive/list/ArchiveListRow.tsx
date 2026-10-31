import { ExternalLinkIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-solid";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { ArchiveGroupSwitcher } from "~/components/archive/ArchiveGroupSwitcher";
import { ArchiveThumb } from "~/components/archive/ArchiveThumb";
import { Text } from "~/components/ui/text";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { ArchivedPageListItem } from "~/services/archive/archive.types";
import { displayHostname, formatExactTime } from "./archive-list-filters";
import { HighlightMatch } from "./HighlightMatch";

export const ARCHIVE_LIST_COLUMNS = {
  base: "56px minmax(0, 1fr)",
  md: "64px minmax(0, 1fr) 150px 72px 64px",
};

const rowActionClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "7",
  h: "7",
  borderRadius: "l2",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a4", color: "fg.default" },
  _focusVisible: { outline: "2px solid", outlineColor: "colorPalette.default" },
});

// An empty group control is noise on every row. Touch has no hover to show it.
const emptyGroupClass = css({
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "fast",
  _groupHover: { opacity: 1 },
  _groupFocusWithin: { opacity: 1 },
  "&:has([aria-expanded=true])": { opacity: 1 },
  "@media (hover: none)": { opacity: 1 },
});

const hostButtonClass = css({
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  py: "1",
  my: "-1",
  transitionProperty: "color",
  transitionDuration: "fast",
  _hover: { color: "colorPalette.default", textDecoration: "none" },
});

export type ArchiveListRowProps = {
  item: ArchivedPageListItem;
  selected: boolean;
  groupOptions: string[];
  query: string;
  onOpen: () => void;
  onFilterHost: (hostname: string) => void;
  onGroupCommit: (groupName: string) => Promise<void>;
  onDelete: () => void;
};

export const ArchiveListRow = (props: ArchiveListRowProps) => {
  const host = () => displayHostname(props.item.siteHostname, props.item.originalUrl);
  const stop = (event: Event) => event.stopPropagation();

  return (
    <Box
      role="row"
      aria-selected={props.selected}
      data-archive-row={props.item.id}
      tabIndex={0}
      mx={{ base: "-2", md: "-3" }}
      display="grid"
      gridTemplateColumns={ARCHIVE_LIST_COLUMNS}
      columnGap="3"
      alignItems="center"
      px={{ base: "2", md: "3" }}
      py="2"
      borderRadius="l2"
      cursor="pointer"
      outline="none"
      _focusVisible={{ boxShadow: "inset 0 0 0 2px var(--colors-gray-a8)" }}
      class="group"
      transitionProperty="background-color"
      transitionDuration="fast"
      bg={props.selected ? "gray.a3" : undefined}
      _hover={{ bg: props.selected ? "gray.a3" : "gray.a2" }}
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpen();
        }
      }}
    >
      <Box role="cell">
        <ArchiveThumb
          imageUrl={props.item.socialPreviewImageUrl || props.item.userImageUrls[0]}
          faviconUrl={props.item.faviconUrl}
          title={props.item.title}
        />
      </Box>

      <Box role="cell" minW="0" display="flex" flexDirection="column" gap="0.5">
        <Text
          fontSize="sm"
          fontWeight="medium"
          lineHeight="snug"
          lineClamp="2"
          color="fg.default"
          title={props.item.title}
        >
          <HighlightMatch text={props.item.title} query={props.query} />
        </Text>
        <HStack gap="1.5" minW="0" fontSize="xs" color="fg.muted" lineHeight="normal">
          <Show when={host()}>
            <button
              type="button"
              class={hostButtonClass}
              title={`Only show ${host()}`}
              onClick={(event) => {
                stop(event);
                props.onFilterHost(props.item.siteHostname || host());
              }}
            >
              <HighlightMatch text={host()} query={props.query} />
            </button>
          </Show>
          <Show when={props.item.description}>
            {(description) => (
              <>
                <Box as="span" color="fg.subtle" flexShrink="0" aria-hidden="true">
                  ·
                </Box>
                <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  <HighlightMatch text={description()} query={props.query} />
                </Box>
              </>
            )}
          </Show>
        </HStack>
        {/* Narrow screens fold group + time into the second line. */}
        <HStack gap="2" hideFrom="md" fontSize="xs" color="fg.muted" minW="0">
          <Show when={props.item.groupName}>
            <Box as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {props.item.groupName}
            </Box>
          </Show>
          <Show when={props.item.lastCapturedAt}>
            {(captured) => (
              <Box as="span" flexShrink="0" title={formatExactTime(captured())}>
                {formatRelativeTime(captured())}
              </Box>
            )}
          </Show>
          <Show when={props.item.notesCount > 0}>
            <NotesCount count={props.item.notesCount} />
          </Show>
        </HStack>
      </Box>

      <Box
        role="cell"
        minW="0"
        hideBelow="md"
        class={props.item.groupName || props.selected ? undefined : emptyGroupClass}
      >
        <ArchiveGroupSwitcher
          value={props.item.groupName || ""}
          options={props.groupOptions}
          placeholder="Add group"
          onCommit={props.onGroupCommit}
        />
      </Box>

      <Box role="cell" hideBelow="md" display="flex" flexDirection="column" alignItems="flex-end" gap="0.5">
        <Text
          fontSize="xs"
          color="fg.muted"
          fontVariantNumeric="tabular-nums"
          whiteSpace="nowrap"
          title={props.item.lastCapturedAt ? formatExactTime(props.item.lastCapturedAt) : undefined}
        >
          {props.item.lastCapturedAt ? formatRelativeTime(props.item.lastCapturedAt) : "—"}
        </Text>
        <Show when={props.item.notesCount > 0}>
          <NotesCount count={props.item.notesCount} />
        </Show>
      </Box>

      <HStack
        role="cell"
        gap="0.5"
        justify="flex-end"
        hideBelow="md"
        opacity={props.selected ? 1 : 0}
        transitionProperty="opacity"
        transitionDuration="fast"
        _groupHover={{ opacity: 1 }}
        _groupFocusWithin={{ opacity: 1 }}
      >
        <a
          href={props.item.originalUrl}
          target="_blank"
          rel="noreferrer"
          class={rowActionClass}
          aria-label={`Open ${props.item.title} in a new tab`}
          title="Open original"
          onClick={stop}
        >
          <ExternalLinkIcon size={15} />
        </a>
        <button
          type="button"
          class={rowActionClass}
          aria-label={`Delete ${props.item.title}`}
          title="Delete"
          onClick={(event) => {
            stop(event);
            props.onDelete();
          }}
        >
          <Trash2Icon size={15} />
        </button>
      </HStack>
    </Box>
  );
};

const NotesCount = (props: { count: number }) => (
  <HStack
    as="span"
    gap="0.5"
    fontSize="xs"
    color="fg.muted"
    flexShrink="0"
    title={`${props.count} ${props.count === 1 ? "note" : "notes"}`}
  >
    <MessageSquareTextIcon size={12} />
    <span>{props.count}</span>
  </HStack>
);
