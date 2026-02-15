import { createAsync, useNavigate } from "@solidjs/router";
import { FolderSearchIcon } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { PathHeadingLink } from "~/components/path/PathHeadingLink";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { PathPillLink } from "~/components/path/PathPillLink";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { fetchRelatedNotesByPath } from "~/services/docs.service";
import {
  buildPathAncestors,
  normalizeDotPath,
  pathToRoute,
} from "~/utils/path-links";

export const PathRelatedNotesPopover = (props: {
  path: string;
  currentDocId?: string;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const normalizedPath = createMemo(() => normalizeDotPath(props.path));
  const ancestors = createMemo(() => buildPathAncestors(normalizedPath()));
  const parentPaths = createMemo(() => ancestors().slice(0, -1).reverse());
  const related = createAsync(() =>
    open() && normalizedPath().length > 0
      ? fetchRelatedNotesByPath({
          path: normalizedPath(),
          currentDocId: props.currentDocId,
          take: 10,
        })
      : Promise.resolve({ path: "", notes: [] })
  );

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={8}
      style={{ width: "min(26rem, 92vw)" }}
      anchor={
        <IconButton
          size="sm"
          variant="outline"
          aria-label="Related notes in this path"
          onClick={() => setOpen((value) => !value)}
          disabled={normalizedPath().length === 0}
        >
          <FolderSearchIcon size={16} />
        </IconButton>
      }
    >
      <Stack gap="3" p="3">
        <Show when={normalizedPath().length > 0}>
          <Stack gap="2">
            <PathHeadingLink
              href={pathToRoute(normalizedPath())}
              variant="popover"
              onClick={() => {
                setOpen(false);
              }}
            >
              {normalizedPath()}
            </PathHeadingLink>
            <HStack gap="2" flexWrap="wrap">
              <For each={parentPaths()}>
                {(parentPath) => (
                  <PathPillLink
                    href={pathToRoute(parentPath)}
                    variant="subtle"
                    onClick={() => setOpen(false)}
                  >
                    Up: {parentPath}
                  </PathPillLink>
                )}
              </For>
            </HStack>
          </Stack>
        </Show>
        <Show when={normalizedPath().length === 0}>
          <Text fontSize="xs" color="fg.muted" fontFamily="mono">
            No path set
          </Text>
        </Show>

        <Box borderTopWidth="1px" borderColor="gray.outline.border" pt="2">
          <Text fontSize="xs" color="fg.muted" mb="2">
            Related notes in same path
          </Text>
          <Show
            when={(related()?.notes.length || 0) > 0}
            fallback={
              <Text fontSize="sm" color="fg.subtle">
                No other notes in this exact path yet.
              </Text>
            }
          >
            <Stack gap="1">
              <For each={related()?.notes || []}>
                {(note) => (
                  <Button
                    size="xs"
                    variant="plain"
                    justifyContent="flex-start"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/docs/${note.id}`);
                    }}
                  >
                    {note.title || "Untitled"}
                  </Button>
                )}
              </For>
            </Stack>
          </Show>
        </Box>
      </Stack>
    </SimplePopover>
  );
};
