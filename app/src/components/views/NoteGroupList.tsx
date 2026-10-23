import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { NoteGroup } from "~/services/note-views.queries";

const groupClass = css({
  borderWidth: "1px",
  borderColor: "gray.outline.border",
  borderRadius: "l2",
  overflow: "hidden",
});
const headerClass = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  px: "3",
  py: "2",
  bg: "gray.a2",
  borderBottomWidth: "1px",
  borderColor: "gray.outline.border",
  color: "fg.default",
  textDecorationLine: "none",
  _hover: { bg: "bg.hover" },
});
export const rowLinkClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "2",
  px: "3",
  py: "1.5",
  color: "fg.default",
  textDecorationLine: "none",
  fontSize: "sm",
  _hover: { bg: "bg.hover" },
  "&:not(:last-child)": { borderBottomWidth: "1px", borderColor: "gray.a3" },
});

/** Items from many notes, grouped under a header that opens each note. */
export function NoteGroupList<T>(props: {
  groups: NoteGroup<T>[];
  empty: string;
  renderItem: (item: T, group: NoteGroup<T>) => JSX.Element;
}) {
  return (
    <Show
      when={props.groups.length > 0}
      fallback={
        <Text color="fg.muted" textStyle="sm">
          {props.empty}
        </Text>
      }
    >
      <Stack gap="3">
        <For each={props.groups}>
          {(group) => (
            <Box class={groupClass}>
              <A href={`/docs/${group.docId}`} class={headerClass}>
                <Text fontWeight="semibold" textStyle="sm" truncate>
                  {group.title}
                </Text>
                <Show when={group.path}>
                  <Text textStyle="xs" color="fg.muted" truncate>
                    {group.path}
                  </Text>
                </Show>
                <Text textStyle="xs" color="fg.subtle" ml="auto" flexShrink="0">
                  {group.items.length}
                </Text>
              </A>
              <For each={group.items}>{(item) => props.renderItem(item, group)}</For>
            </Box>
          )}
        </For>
      </Stack>
    </Show>
  );
}
