import { For, Show, type Accessor } from "solid-js";
import { usePopover } from "../hooks/usePopover";
import type { SourcesResponse } from "../data/docs.service";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, Stack } from "styled-system/jsx";

export const ActionsPopover = (props: {
  sources: Accessor<SourcesResponse | undefined>;
  onBulkSetSource: () => Promise<void>;
  onCleanupTitles: () => Promise<void>;
  onProcessPathRound: () => Promise<void>;
  onScanRelativeImages: () => Promise<void>;
  onDeleteBySource: (source: string, count: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  const pop = usePopover();

  return (
    <Box position="relative">
      <Button
        ref={(el) => pop.setAnchor(el as unknown as HTMLElement)}
        size="sm"
        variant="outline"
        onClick={pop.togglePopover}
      >
        ⚙️ Actions
      </Button>
      <Show when={pop.open()}>
        <Box
          ref={(el) => pop.setPopover(el as unknown as HTMLElement)}
          position="absolute"
          right="0"
          mt="0.5rem"
          width="20rem"
          bg="white"
          borderWidth="1px"
          borderColor="gray.outline.border"
          borderRadius="l2"
          boxShadow="lg"
          zIndex="50"
          p="0.75rem"
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
                    pop.closePopover();
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
                    pop.closePopover();
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
                    pop.closePopover();
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
                    pop.closePopover();
                  }}
                >
                  Clean Bad Titles
                </Button>
              </Stack>
            </Box>
            <Box borderTopWidth="1px" borderColor="gray.outline.border" pt="0.75rem">
              <Text
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                color="red.11"
                mb="0.5rem"
              >
                ⚠️ Dangerous Actions
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
                            pop.closePopover();
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
                    pop.closePopover();
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
        </Box>
      </Show>
    </Box>
  );
};
