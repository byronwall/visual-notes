import { For, Show, Suspense, type Accessor } from "solid-js";
import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import * as Table from "~/components/ui/table";
import { Box } from "styled-system/jsx";
import { formatTimestampUtc } from "~/features/umap/format";
import type { UmapRun } from "~/features/umap/types";

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
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header textAlign="left">Run</Table.Header>
                  <Table.Header textAlign="left">Dims</Table.Header>
                  <Table.Header textAlign="left">Embedding</Table.Header>
                  <Table.Header textAlign="left">Model</Table.Header>
                  <Table.Header textAlign="left">Created</Table.Header>
                  <Table.Header textAlign="left">Clone</Table.Header>
                  <Table.Header textAlign="right">Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={items()}>
                  {(run) => (
                    <Table.Row>
                      <Table.Cell>
                        <Link href={`/umap/${run.id}`}>{run.id.slice(0, 8)}</Link>
                      </Table.Cell>
                      <Table.Cell>{run.dims}D</Table.Cell>
                      <Table.Cell>
                        <Link href={`/embeddings/${run.embeddingRunId}`}>
                          {run.embeddingRunId.slice(0, 8)}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <Text textStyle="sm" color="fg.muted">
                          {run.hasArtifact ? "Trained" : "Missing"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>{formatTimestampUtc(run.createdAt)}</Table.Cell>
                      <Table.Cell>
                        <Button size="xs" variant="outline" onClick={() => props.onClone(run)}>
                          Clone
                        </Button>
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <Link href={`/umap/${run.id}`}>View</Link>
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
