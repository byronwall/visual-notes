import { For, Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { PathHeadingLink } from "~/components/path/PathHeadingLink";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { type PathGroupSection as PathGroupSectionType } from "../hooks/usePathGroups";
import { normalizeDotPath, pathToRoute } from "~/utils/path-links";

const notePathLabel = (notePath: string, groupPath: string) => {
  const normalizedNotePath = normalizeDotPath(notePath);
  const normalizedGroupPath = normalizeDotPath(groupPath);
  if (!normalizedNotePath) return "";
  if (normalizedNotePath === normalizedGroupPath) return "";
  const prefix = `${normalizedGroupPath}.`;
  if (normalizedNotePath.startsWith(prefix)) {
    return normalizedNotePath.slice(prefix.length);
  }
  return normalizedNotePath;
};

export const PathGroupSection = (props: {
  group: PathGroupSectionType;
  notes: PathGroupSectionType["notes"];
  previewById: Map<
    string,
    {
      previewText?: string;
      path?: string | null;
      meta?: Record<string, unknown> | null;
    }
  >;
  titleTriggerClass: string;
  pathSubtitleClass: string;
  canExpand: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) => {
  return (
    <Stack gap="3">
      <HStack gap="2" alignItems="baseline" flexWrap="wrap">
        <PathHeadingLink href={pathToRoute(props.group.groupPath)}>
          {props.group.groupPath}
        </PathHeadingLink>
        <Text fontSize="sm" color="fg.muted">
          {props.group.notes.length} notes
        </Text>
      </HStack>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)",
        }}
        gap="3"
      >
        <For each={props.notes}>
          {(note) => (
            <Card.Root>
              <Card.Body p="4">
                <Stack gap="2">
                  <DocHoverPreviewLink
                    href={`/docs/${note.id}`}
                    title={note.title || "Untitled"}
                    updatedAt={note.updatedAt}
                    path={note.path}
                    previewDoc={props.previewById.get(note.id) || null}
                    triggerClass={props.titleTriggerClass}
                  >
                    {note.title || "Untitled"}
                  </DocHoverPreviewLink>
                  <Show when={notePathLabel(note.path || "", props.group.groupPath).length > 0}>
                    <Text class={props.pathSubtitleClass}>
                      {notePathLabel(note.path || "", props.group.groupPath)}
                    </Text>
                  </Show>
                  <Text fontSize="sm" color="fg.subtle">
                    Updated {note.updatedAt.slice(0, 16).replace("T", " ")}
                  </Text>
                </Stack>
              </Card.Body>
            </Card.Root>
          )}
        </For>
      </Box>
      <Show when={props.canExpand}>
        <Button
          size="sm"
          variant="outline"
          alignSelf="flex-start"
          onClick={props.onToggleExpanded}
        >
          {props.expanded
            ? `Show less (${props.group.notes.length - 10} hidden)`
            : `Expand to see more (${props.group.notes.length - 10} more)`}
        </Button>
      </Show>
    </Stack>
  );
};
