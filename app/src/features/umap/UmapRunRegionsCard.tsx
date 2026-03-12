import { For, Show, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import * as HoverCard from "~/components/ui/hover-card";
import { Link } from "~/components/ui/link";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { formatRelativeTimestamp } from "~/features/umap/format";
import type { UmapRegionItem, UmapRegionsSnapshot } from "~/features/umap/region-types";

type UmapRunRegionsCardProps = {
  runId: string;
  regions: UmapRegionsSnapshot | null | undefined;
  busy: boolean;
  onRegenerate: () => void;
};

export function UmapRunRegionsCard(props: UmapRunRegionsCardProps) {
  const sortedRegions = createMemo(() =>
    (props.regions?.regions ?? [])
      .slice()
      .sort((a, b) => b.docCount - a.docCount || a.title.localeCompare(b.title))
  );

  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l3" overflow="hidden">
      <Stack gap="0">
        <HStack
          justify="space-between"
          alignItems="flex-start"
          gap="4"
          px="4"
          py="4"
          bg="bg.subtle"
          borderBottomWidth="1px"
          borderColor="border"
          flexWrap="wrap"
        >
          <Stack gap="1">
            <Heading as="h2" fontSize="lg">
              Put Into Groups
            </Heading>
            <Text textStyle="sm" color="fg.muted" maxW="760px">
              Scan the generated groups in a dense table, hover a topic for a fuller summary, and open any group on its own SSR page to inspect the notes inside it.
            </Text>
            <Show when={props.regions}>
              {(regions) => (
                <HStack gap="3" flexWrap="wrap">
                  <Text textStyle="xs" color="fg.muted">
                    {sortedRegions().length} groups
                  </Text>
                  <Text textStyle="xs" color="fg.muted">
                    Updated {formatRelativeTimestamp(regions().generatedAt)}
                  </Text>
                </HStack>
              )}
            </Show>
          </Stack>

          <Button size="sm" variant="outline" loading={props.busy} onClick={props.onRegenerate}>
            Regenerate Groups
          </Button>
        </HStack>

        <Box px="4" py="4">
          <Show
            when={props.regions && sortedRegions().length > 0}
            fallback={
              <Text textStyle="sm" color="fg.muted">
                No groups generated yet for this run.
              </Text>
            }
          >
            <Box overflowX="auto" overflowY="auto" maxH="600px" borderWidth="1px" borderColor="border" borderRadius="l2">
              <Table.Root tableLayout="fixed" w="full">
                <Table.Head position="sticky" top="0" bg="bg.default" zIndex="10" boxShadow="sm">
                  <Table.Row>
                    <Table.Header textAlign="left" w="220px">Group</Table.Header>
                    <Table.Header textAlign="right" w="80px">Notes</Table.Header>
                    <Table.Header textAlign="left">Sample Notes</Table.Header>
                    <Table.Header textAlign="right" w="100px">Open</Table.Header>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  <For each={sortedRegions()}>
                    {(region) => {
                      return (
                        <Table.Row>
                          <Table.Cell whiteSpace="normal" verticalAlign="top">
                            <RegionHoverLink runId={props.runId} region={region} />
                          </Table.Cell>
                          <Table.Cell textAlign="right" verticalAlign="top">
                            <Text textStyle="sm" color="fg.default">
                              {region.docCount}
                            </Text>
                          </Table.Cell>
                          <Table.Cell whiteSpace="normal" verticalAlign="top">
                            <Text textStyle="sm" color="fg.muted" lineClamp="2">
                              {region.sampleDocs.map((sample) => sample.title).join(", ")}
                            </Text>
                          </Table.Cell>
                          <Table.Cell textAlign="right" verticalAlign="top">
                            <Link href={`/umap/${props.runId}/groups/${region.id}`}>Open group</Link>
                          </Table.Cell>
                        </Table.Row>
                      );
                    }}
                  </For>
                </Table.Body>
              </Table.Root>
            </Box>
          </Show>
        </Box>
      </Stack>
    </Box>
  );
}

function RegionHoverLink(props: { runId: string; region: UmapRegionItem }) {
  return (
    <HoverCard.Root openDelay={100} closeDelay={100}>
      <HoverCard.Trigger
        asChild={(triggerProps) => (
          <Link
            {...triggerProps}
            href={`/umap/${props.runId}/groups/${props.region.id}`}
          >
            {props.region.title}
          </Link>
        )}
      />
      <Portal>
        <HoverCard.Positioner>
          <HoverCard.Content maxW="360px">
            <Stack gap="3">
              <Stack gap="1">
                <Heading as="h3" fontSize="sm">
                  {props.region.title}
                </Heading>
                <Text textStyle="xs" color="fg.muted">
                  {props.region.docCount} notes
                </Text>
              </Stack>
              <Text textStyle="sm" color="fg.default">
                {props.region.summary}
              </Text>
              <Stack gap="1">
                <Text textStyle="xs" color="fg.muted">
                  Sample notes
                </Text>
                <For each={props.region.sampleDocs.slice(0, 4)}>
                  {(sample) => (
                    <Text textStyle="sm" color="fg.default">
                      {sample.title}
                    </Text>
                  )}
                </For>
              </Stack>
            </Stack>
          </HoverCard.Content>
        </HoverCard.Positioner>
      </Portal>
    </HoverCard.Root>
  );
}
