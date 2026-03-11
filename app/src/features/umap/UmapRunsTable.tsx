import { For, Show, Suspense, type Accessor } from "solid-js";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import * as Table from "~/components/ui/table";
import { Box, HStack } from "styled-system/jsx";
import { formatRelativeTimestamp } from "~/features/umap/format";
import type { UmapRun } from "~/features/umap/types";
import { CopyIcon } from "lucide-solid";

type UmapRunsTableProps = {
  runs: Accessor<UmapRun[] | undefined>;
  onClone: (run: UmapRun) => void;
};

export function UmapRunsTable(props: UmapRunsTableProps) {
  return (
    <Suspense
      fallback={
        <Box fontSize="sm" color="fg.muted">
          Loading…
        </Box>
      }
    >
      <Show when={props.runs()}>
        {(items) => (
          <Box borderWidth="1px" borderColor="border" borderRadius="l2" overflow="hidden">
            <HStack
              justify="space-between"
              alignItems="center"
              px="3"
              py="3"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Heading as="h2" fontSize="sm">
                Existing Runs
              </Heading>
              <Text textStyle="xs" color="fg.muted">
                {items().length} total
              </Text>
            </HStack>
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header textAlign="left">Run</Table.Header>
                  <Table.Header textAlign="left">Embedding</Table.Header>
                  <Table.Header textAlign="left">Dims</Table.Header>
                  <Table.Header textAlign="left">Status</Table.Header>
                  <Table.Header textAlign="left">Groups</Table.Header>
                  <Table.Header textAlign="left">Created</Table.Header>
                  <Table.Header textAlign="right">Clone</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={items()}>
                  {(run) => (
                    <Table.Row>
                      <Table.Cell>
                        <Link href={`/umap/${run.id}`}>{run.id.slice(0, 8)}</Link>
                      </Table.Cell>
                      <Table.Cell>
                        <Link href={`/embeddings/${run.embeddingRunId}`}>
                          {run.embeddingRunId.slice(0, 8)}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>{run.dims}D</Table.Cell>
                      <Table.Cell>{run.hasArtifact ? "Trained" : "Missing"}</Table.Cell>
                      <Table.Cell>
                        {run.regionCount > 0 ? `${run.regionCount} ready` : "Pending"}
                      </Table.Cell>
                      <Table.Cell>{formatRelativeTimestamp(run.createdAt)}</Table.Cell>
                      <Table.Cell textAlign="right">
                        <Tooltip
                          content="Copy this run's params into the New UMAP Run form"
                          showArrow
                        >
                          <IconButton
                            size="xs"
                            variant="outline"
                            aria-label="Use run settings"
                            onClick={() => props.onClone(run)}
                          >
                            <CopyIcon size={12} />
                          </IconButton>
                        </Tooltip>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Show>
    </Suspense>
  );
}
