import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { formatParamValue } from "~/features/umap/format";
import { Box, Flex, Grid, Stack } from "styled-system/jsx";

type UmapRunParamsCardProps = {
  paramEntries: [string, unknown][];
};

export function UmapRunParamsCard(props: UmapRunParamsCardProps) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l3" p="3">
      <Stack gap="2">
        <Flex align="center" justify="space-between" gap="3">
          <Heading as="h2" fontSize="sm">
            Training Params
          </Heading>
          <Badge colorPalette="gray">{props.paramEntries.length}</Badge>
        </Flex>

        <Show
          when={props.paramEntries.length > 0}
          fallback={
            <Text textStyle="sm" color="fg.muted">
              No training parameters were recorded.
            </Text>
          }
        >
          <Box maxH={{ base: "none", xl: "calc(100vh - 360px)" }} overflowY="auto">
            <Stack gap="0">
              <For each={props.paramEntries}>
                {([key, value]) => (
                  <Grid
                    gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.3fr)"
                    gap="3"
                    py="2"
                    borderTopWidth="1px"
                    borderColor="border"
                    alignItems="start"
                  >
                    <Text
                      textStyle="xs"
                      fontFamily="mono"
                      color="fg.subtle"
                      lineBreak="anywhere"
                    >
                      {key}
                    </Text>
                    <Text textStyle="xs" lineBreak="anywhere">
                      {formatParamValue(value)}
                    </Text>
                  </Grid>
                )}
              </For>
            </Stack>
          </Box>
        </Show>
      </Stack>
    </Box>
  );
}
