import { createAsync, useAction } from "@solidjs/router";
import { For, Show, createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Link } from "~/components/ui/link";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import {
  fetchBlockMigrationCounts,
  runBlockMigration,
  type BlockMigrationBatch,
} from "~/services/admin/block-migration.actions";

const LOSSY_PCT = 2;

/** Dry-run and apply the one-time legacy html/markdown → blocks conversion. */
export const BlockMigrationPanel: VoidComponent = () => {
  const counts = createAsync(() => fetchBlockMigrationCounts());
  const run = useAction(runBlockMigration);
  const [running, setRunning] = createSignal<"dry" | "apply" | null>(null);
  const [report, setReport] = createSignal<BlockMigrationBatch["rows"]>([]);
  const [summary, setSummary] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const execute = async (dryRun: boolean) => {
    setRunning(dryRun ? "dry" : "apply");
    setError(undefined);
    const rows: BlockMigrationBatch["rows"] = [];
    let cursor: string | null = null;
    try {
      for (;;) {
        const batch: BlockMigrationBatch = await run({ dryRun, cursor });
        rows.push(...batch.rows);
        if (batch.processed === 0) break;
        if (dryRun ? !batch.nextCursor : batch.remaining === 0) break;
        if (!dryRun && batch.migrated === 0) break;
        cursor = batch.nextCursor;
      }
      const lossy = rows.filter((r) => r.lossPct > LOSSY_PCT || r.error);
      setReport(lossy);
      setSummary(
        `${dryRun ? "Dry run" : "Applied"}: ${rows.length} notes checked, ${lossy.length} lose more than ${LOSSY_PCT}% of their text or failed.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Migration batch failed");
    } finally {
      setRunning(null);
    }
  };

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l3"
      p="4"
      bg="bg.default"
    >
      <Stack gap="3">
        <Stack gap="1">
          <Heading as="h2" fontSize="xl">
            Block storage migration
          </Heading>
          <Text color="fg.muted" textStyle="sm">
            Converts notes still stored as HTML/markdown into blocks. Each
            note is snapshotted as a revision first; the old columns are left
            untouched.
          </Text>
          <Show when={counts()}>
            {(c) => (
              <Text textStyle="sm">
                {c().migrated} of {c().total} notes use blocks ·{" "}
                {c().remaining} remaining
              </Text>
            )}
          </Show>
        </Stack>
        <HStack gap="2">
          <Button
            size="sm"
            variant="outline"
            loading={running() === "dry"}
            disabled={running() !== null}
            onClick={() => void execute(true)}
          >
            Dry run
          </Button>
          <Button
            size="sm"
            loading={running() === "apply"}
            disabled={running() !== null || counts()?.remaining === 0}
            onClick={() => void execute(false)}
          >
            Convert remaining notes
          </Button>
        </HStack>
        <Show when={error()}>
          <Text color="red.11" textStyle="sm">
            {error()}
          </Text>
        </Show>
        <Show when={summary()}>
          <Text textStyle="sm">{summary()}</Text>
        </Show>
        <Show when={report().length > 0}>
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.Header>Note</Table.Header>
                <Table.Header>Text before → after</Table.Header>
                <Table.Header>Loss</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              <For each={report()}>
                {(row) => (
                  <Table.Row>
                    <Table.Cell>
                      <Link href={`/docs/${row.id}`}>{row.title}</Link>
                    </Table.Cell>
                    <Table.Cell>
                      {row.error ?? `${row.beforeChars} → ${row.afterChars}`}
                    </Table.Cell>
                    <Table.Cell>{row.lossPct}%</Table.Cell>
                  </Table.Row>
                )}
              </For>
            </Table.Body>
          </Table.Root>
        </Show>
      </Stack>
    </Box>
  );
};
