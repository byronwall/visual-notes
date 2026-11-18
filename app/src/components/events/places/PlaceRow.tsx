import { A } from "@solidjs/router";
import {
  EllipsisIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MapPinOffIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-solid";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { RowListRow } from "~/components/ui/row-list";
import * as Menu from "~/components/ui/menu";
import { PLACE_KIND_LABELS } from "~/lib/events/types";
import type { PlaceWithCounts } from "~/lib/events/view-types";
import { optionColorVars } from "~/lib/collections/colors";
import { KIND_COLORS } from "../map/mapPoints";

// Columns come from PlacesView. Phones: name over meta, actions at right.
const row = css({
  rowGap: "0.5",
  py: { base: "2", md: "1.5" },
  fontSize: "sm",
  _hover: { bg: "bg.subtle" },
});
const truncate = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minW: "0",
} as const;
const nameCell = css({
  gridColumn: { base: "1", md: "auto" },
  gridRow: { base: "1", md: "auto" },
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  minW: "0",
  "& > span": { ...truncate, fontWeight: "medium" },
  "& svg": { flexShrink: "0", color: "fg.subtle" },
});
const kindChip = css({
  display: { base: "none", md: "inline-flex" },
  alignSelf: "center",
  justifySelf: "start",
  px: "1.5",
  h: "5",
  alignItems: "center",
  borderRadius: "l1",
  fontSize: "xs",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
});
const address = css({
  display: { base: "none", md: "block" },
  color: "fg.muted",
  ...truncate,
});
const count = css({
  display: { base: "none", md: "block" },
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
});
const meta = css({
  gridColumn: "1",
  gridRow: "2",
  display: { base: "block", md: "none" },
  fontSize: "xs",
  color: "fg.muted",
  ...truncate,
});
const actions = css({
  gridColumn: { base: "2", md: "auto" },
  gridRow: { base: "1 / span 2", md: "auto" },
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.5",
});

const iconLink = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "7",
  h: "7",
  borderRadius: "l2",
  color: "fg.muted",
  _hover: { bg: "bg.muted", color: "fg.default" },
});

/** One place; the menu edits, deletes, or opens its links. */
export function PlaceRow(props: {
  place: PlaceWithCounts;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = () => props.place;
  const noCoords = () => p().latitude == null || p().longitude == null;
  const metaText = () =>
    [
      PLACE_KIND_LABELS[p().kind],
      p().upcomingCount ? `${p().upcomingCount} upcoming` : "",
      p().address,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <RowListRow class={row} data-place-row={p().id}>
      <div class={nameCell}>
        <span title={p().name}>{p().name}</span>
        <Show when={noCoords()}>
          <span title="No coordinates; not on the map">
            <MapPinOffIcon size={12} aria-label="Not on the map" />
          </span>
        </Show>
      </div>
      <span class={kindChip} style={optionColorVars(KIND_COLORS[p().kind])}>
        {PLACE_KIND_LABELS[p().kind]}
      </span>
      <span class={address} title={p().address || undefined}>
        {p().address || "—"}
      </span>
      <span class={count}>{p().upcomingCount || "—"}</span>
      <span class={meta} title={metaText()}>
        {metaText()}
      </span>
      <div class={actions}>
        <Show when={p().docId}>
          {(docId) => (
            <A
              href={`/docs/${docId()}`}
              class={iconLink}
              aria-label={`Open write-up for ${p().name}`}
              title="Open write-up note"
            >
              <FileTextIcon size={14} />
            </A>
          )}
        </Show>
        <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger
            asChild={(triggerProps) => (
              <IconButton
                {...triggerProps}
                size="xs"
                variant="plain"
                aria-label={`Actions for ${p().name}`}
              >
                <EllipsisIcon size={14} />
              </IconButton>
            )}
          />
          <Portal>
            <Menu.Positioner zIndex="popover">
              <Menu.Content zIndex="popover">
                <Menu.Item value="edit" onSelect={props.onEdit}>
                  <HStack gap="2">
                    <PencilIcon size={14} /> Edit
                  </HStack>
                </Menu.Item>
                <Show when={p().url}>
                  {(url) => (
                    <Menu.Item
                      value="site"
                      onSelect={() =>
                        window.open(url(), "_blank", "noopener,noreferrer")
                      }
                    >
                      <HStack gap="2">
                        <ExternalLinkIcon size={14} /> Website
                      </HStack>
                    </Menu.Item>
                  )}
                </Show>
                <Menu.Separator />
                <Menu.Item
                  value="delete"
                  color="red.11"
                  onSelect={props.onDelete}
                >
                  <HStack gap="2">
                    <Trash2Icon size={14} /> Delete
                  </HStack>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </div>
    </RowListRow>
  );
}
