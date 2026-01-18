import { For, Show, createSignal, type Accessor } from "solid-js";
import type { SourcesResponse } from "../data/docs.service";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { AlertTriangleIcon, SettingsIcon } from "lucide-solid";
import { SimplePopover } from "~/components/ui/simple-popover";

export const ActionsPopover = (props: {
  sources: Accessor<SourcesResponse | undefined>;
  onBulkSetSource: () => Promise<void>;
  onCleanupTitles: () => Promise<void>;
  onProcessPathRound: () => Promise<void>;
  onScanRelativeImages: () => Promise<void>;
  onDeleteBySource: (source: string, count: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  const [open, setOpen] = createSignal(false);

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={8}
      style={{ width: "20rem", padding: "0.75rem" }}
      anchor={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
        >
          <HStack gap="1" alignItems="center">
            <SettingsIcon size={16} />
            <Box as="span">Actions</Box>
          </HStack>
        </Button>
      }
    >
      <Stack gap="0.75rem">
        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            color="black.a7"
            mb="0.5rem"
          >
            Bulk Actions
          </Text>
          <Stack gap="0.5rem">
            <Button
              width="100%"
              size="sm"
              colorPalette="green"
              onClick={async () => {
                await props.onProcessPathRound();
                setOpen(false);
              }}
            >
              Process one path round
            </Button>
            <Button
              width="100%"
              size="sm"
              colorPalette="olive"
              onClick={async () => {
                await props.onScanRelativeImages();
                setOpen(false);
              }}
            >
              Mark notes with relative images
            </Button>
            <Button
              width="100%"
              size="sm"
              variant="surface"
              onClick={async () => {
                await props.onBulkSetSource();
                setOpen(false);
              }}
            >
              Set Source (All)
            </Button>
            <Button
              width="100%"
              size="sm"
              colorPalette="grass"
              onClick={async () => {
                await props.onCleanupTitles();
                setOpen(false);
              }}
            >
              Clean Bad Titles
            </Button>
          </Stack>
        </Box>
        <Box
          borderTopWidth="1px"
          borderColor="gray.outline.border"
          pt="0.75rem"
        >
          <Text
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            color="red.11"
            mb="0.5rem"
            display="flex"
            alignItems="center"
            gap="2"
          >
            <AlertTriangleIcon size={14} />
            Dangerous Actions
          </Text>
          <Stack gap="0.5rem">
            <Show when={props.sources()}>
              {(data) => (
                <For each={data().sources}>
                  {(s) => (
                    <Button
                      width="100%"
                      size="sm"
                      colorPalette="olive"
                      onClick={async () => {
                        await props.onDeleteBySource(
                          s.originalSource,
                          s.count
                        );
                        setOpen(false);
                      }}
                    >
                      Delete {s.originalSource} ({s.count})
                    </Button>
                  )}
                </For>
              )}
            </Show>
            <Button
              width="100%"
              size="sm"
              colorPalette="red"
              onClick={async () => {
                await props.onDeleteAll();
                setOpen(false);
              }}
            >
              Delete All
              <Show when={props.sources()}>
                {(d) => <span> ({d().total})</span>}
              </Show>
            </Button>
          </Stack>
        </Box>
      </Stack>
    </SimplePopover>
  );
};
