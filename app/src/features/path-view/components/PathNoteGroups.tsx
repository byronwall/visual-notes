import { createAsync } from "@solidjs/router";
import { For, createMemo } from "solid-js";
import { Stack } from "styled-system/jsx";
import { fetchDocPreviewsBatched } from "~/services/docs.service";
import { PathGroupSection } from "~/features/path-view/components/PathGroupSection";
import { usePathGroups } from "~/features/path-view/hooks/usePathGroups";
import type { PathGroupNote } from "~/features/path-view/hooks/usePathGroups";
import { css } from "styled-system/css";

const titleTriggerClass = css({
  display: "inline-flex",
  color: "inherit",
  textDecoration: "none",
  fontWeight: "semibold",
  fontSize: "xl",
  lineHeight: "1.3",
  _hover: { textDecoration: "underline" },
});

const pathSubtitleClass = css({
  fontSize: "sm",
  color: "fg.muted",
  fontFamily: "mono",
});

export const PathNoteGroups = (props: {
  path: () => string;
  notes: () => PathGroupNote[];
}) => {
  const groups = usePathGroups({
    path: () => props.path(),
    notes: () => props.notes(),
  });
  const previewDocs = createAsync(() =>
    fetchDocPreviewsBatched(groups.visibleNoteIds()),
  );
  const previewById = createMemo(
    () => new Map((previewDocs() || []).map((item) => [item.id, item])),
  );

  return (
    <Stack gap="6">
      <For each={groups.grouped()}>
        {(group) => (
          <PathGroupSection
            group={group}
            notes={groups.visibleNotesForGroup(group)}
            previewById={previewById()}
            titleTriggerClass={titleTriggerClass}
            pathSubtitleClass={pathSubtitleClass}
            canExpand={groups.canExpandGroup(group)}
            expanded={groups.isGroupExpanded(group.groupPath)}
            onToggleExpanded={() => groups.toggleGroupExpanded(group.groupPath)}
          />
        )}
      </For>
    </Stack>
  );
};
