import { createAsync, revalidate, useAction } from "@solidjs/router";
import {
  ErrorBoundary,
  For,
  Show,
  Suspense,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { createStore } from "solid-js/store";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Link } from "~/components/ui/link";
import * as Table from "~/components/ui/table";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { Box, Container, Grid, HStack, Stack } from "styled-system/jsx";
import {
  recoverInlineImageMigrationBackup,
  runHeicToJpegBatch,
  runInlineImageMigrationBatch,
} from "~/services/admin/inline-image-migration.actions";
import {
  fetchInlineImageMigrationCounts,
  fetchInlineImageMigrationImageStorage,
  fetchInlineImageMigrationRecentBackups,
} from "~/services/admin/inline-image-migration.queries";
import type { InlineImageMigrationBatchResult } from "~/services/admin/inline-image-migration.types";
import type { HeicTranscodeBatchResult } from "~/services/admin/inline-image-migration.types";

type RunLog = {
  at: string;
  result: InlineImageMigrationBatchResult;
};

type HeicRunLog = {
  at: string;
  result: HeicTranscodeBatchResult;
};

function formatUtcTimestamp(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const StatCard = (props: { label: string; value: string; hint?: string }) => {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l3"
      p="4"
      bgGradient="to-br"
      gradientFrom="bg.default"
      gradientTo="gray.2"
    >
      <Text textStyle="xs" color="fg.muted" textTransform="uppercase">
        {props.label}
      </Text>
      <Heading as="h3" fontSize="2xl" mt="1">
        {props.value}
      </Heading>
      <Show when={props.hint}>
        <Text textStyle="xs" color="fg.muted" mt="1">
          {props.hint}
        </Text>
      </Show>
    </Box>
  );
};

const MigrationPanel: VoidComponent = () => {
  const titleLinkClass = css({
    display: "block",
    color: "inherit",
    textDecorationLine: "none",
    minWidth: "0",
  });

  const countsStatus = createAsync(() => fetchInlineImageMigrationCounts());
  const recentBackups = createAsync(() => fetchInlineImageMigrationRecentBackups());
  const imageStorageStatus = createAsync(() => fetchInlineImageMigrationImageStorage());
  const runBatch = useAction(runInlineImageMigrationBatch);
  const runHeicBatchAction = useAction(runHeicToJpegBatch);
  const runRecoverBackup = useAction(recoverInlineImageMigrationBackup);
  const [state, setState] = createStore({
    limit: "10",
    dryRun: false,
    running: false,
    error: "",
  });
  const [runLogs, setRunLogs] = createSignal<RunLog[]>([]);
  const [heicRunLogs, setHeicRunLogs] = createSignal<HeicRunLog[]>([]);
  const [recoveringDocId, setRecoveringDocId] = createSignal<string | null>(null);
  const refreshStatus = async () => {
    await Promise.all([
      revalidate(fetchInlineImageMigrationCounts.key),
      revalidate(fetchInlineImageMigrationRecentBackups.key),
      revalidate(fetchInlineImageMigrationImageStorage.key),
    ]);
  };

  const run = async () => {
    const parsed = Number(state.limit);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(200, parsed)) : 10;
    try {
      setState("running", true);
      setState("error", "");
      console.log("[admin.migrations] run", { limit, dryRun: state.dryRun });
      const result = await runBatch({ limit, dryRun: state.dryRun });
      setRunLogs((prev) => [
        { at: new Date().toISOString(), result },
        ...prev,
      ]);
      await refreshStatus();
    } catch (e) {
      setState(
        "error",
        e instanceof Error ? e.message : "Failed to run migration batch"
      );
    } finally {
      setState("running", false);
    }
  };

  const recoverDoc = async (docId: string) => {
    if (!docId || recoveringDocId()) return;
    if (!confirm("Recover this document to its pre-migration backup content?")) {
      return;
    }
    try {
      setRecoveringDocId(docId);
      setState("error", "");
      await runRecoverBackup({ docId });
      await refreshStatus();
    } catch (e) {
      setState(
        "error",
        e instanceof Error ? e.message : "Failed to recover backup content"
      );
    } finally {
      setRecoveringDocId(null);
    }
  };

  const runHeicBatch = async () => {
    const parsed = Number(state.limit);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(200, parsed)) : 10;
    try {
      setState("running", true);
      setState("error", "");
      console.log("[admin.migrations] heic->jpeg run", {
        limit,
        dryRun: state.dryRun,
      });
      const result = await runHeicBatchAction({ limit, dryRun: state.dryRun });
      setHeicRunLogs((prev) => [{ at: new Date().toISOString(), result }, ...prev]);
      await refreshStatus();
    } catch (e) {
      setState(
        "error",
        e instanceof Error ? e.message : "Failed to run HEIC to JPEG batch"
      );
    } finally {
      setState("running", false);
    }
  };

  return (
    <Stack gap="5">
      <Box
        borderWidth="1px"
        borderColor="gray.outline.border"
        borderRadius="l3"
        p="4"
        bg="bg.default"
      >
        <Heading as="h1" fontSize="2xl">
          Inline Image Migration
        </Heading>
        <Text color="fg.muted" mt="1">
          Convert inline data URLs to disk-backed files and track progress.
        </Text>
      </Box>

      <Suspense fallback={<Text color="fg.muted">Loading migration status…</Text>}>
        <Show when={countsStatus()}>
          {(s) => (
            <Stack gap="4">
              <Grid
                gridTemplateColumns={{
                  base: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                }}
                gap="3"
              >
                <StatCard label="Total Docs" value={String(s().totalDocs)} />
                <StatCard
                  label="Inline Data URL Docs"
                  value={String(s().docsWithInlineDataImages)}
                  hint="Remaining candidates"
                />
                <StatCard
                  label="Docs With Backup"
                  value={String(s().docsWithBackup)}
                  hint="Saved pre-migration content"
                />
                <StatCard
                  label="Disk URL Rewrites"
                  value={String(s().docsRewrittenToDiskUrls)}
                />
                <StatCard
                  label="Backed Up Still Inline"
                  value={String(s().docsWithBackupAndStillInlineDataImages)}
                  hint="Needs another pass"
                />
              </Grid>
              <Box
                borderWidth="1px"
                borderColor="gray.outline.border"
                borderRadius="l2"
                p="3"
                bg="gray.2"
              >
                <Text textStyle="sm" color="fg.muted">
                  Storage directory: <Box as="code">{s().storageDir}</Box>
                </Text>
              </Box>
            </Stack>
          )}
        </Show>
      </Suspense>

      <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l3" p="4">
        <HStack gap="3" alignItems="end" flexWrap="wrap">
          <Box>
            <Text textStyle="xs" color="fg.muted" mb="1">
              Batch size
            </Text>
            <Input
              type="number"
              min="1"
              max="200"
              value={state.limit}
              onInput={(e) => setState("limit", e.currentTarget.value)}
              w="120px"
            />
          </Box>
          <Tooltip
            content="Toggle dry-run mode. When on, no docs or files are changed."
            showArrow
          >
            <Button
              variant={state.dryRun ? "outline" : "subtle"}
              onClick={() => setState("dryRun", !state.dryRun)}
            >
              {state.dryRun ? "Dry Run: ON" : "Dry Run: OFF"}
            </Button>
          </Tooltip>
          <Tooltip
            content="Migrate inline data image URLs in a batch and rewrite to disk image URLs."
            showArrow
          >
            <Button loading={state.running} onClick={() => void run()}>
              Run Batch
            </Button>
          </Tooltip>
          <Tooltip
            content="Transcode /api/doc-images/*.heic references to JPEG and rewrite note URLs."
            showArrow
          >
            <Button
              variant="outline"
              loading={state.running}
              onClick={() => void runHeicBatch()}
            >
              HEIC to JPEG
            </Button>
          </Tooltip>
          <Tooltip content="Reload migration metrics and backup rows from the server." showArrow>
            <Button
              variant="outline"
              disabled={state.running}
              onClick={() => void refreshStatus()}
            >
              Refresh Status
            </Button>
          </Tooltip>
        </HStack>
        <Show when={state.error}>
          <Text color="red.10" textStyle="sm" mt="2">
            {state.error}
          </Text>
        </Show>
      </Box>

      <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l3" p="4">
        <Heading as="h2" fontSize="lg" mb="3">
          Run History
        </Heading>
        <Show when={runLogs().length > 0} fallback={<Text color="fg.muted">No runs yet.</Text>}>
          <For each={runLogs()}>
            {(log) => (
              <Box borderTopWidth="1px" borderColor="gray.outline.border" pt="2" mt="2">
                <Text textStyle="xs" color="fg.muted">
                  {formatUtcTimestamp(log.at)}
                </Text>
                <Text textStyle="sm">
                  {log.result.dryRun ? "Dry run" : "Live run"}: updated {log.result.updatedDocs}
                  , migrated refs {log.result.migratedImageRefs}, failures {log.result.failures.length}
                </Text>
              </Box>
            )}
          </For>
        </Show>
      </Box>

      <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l3" p="4">
        <Heading as="h2" fontSize="lg" mb="3">
          HEIC to JPEG Runs
        </Heading>
        <Show
          when={heicRunLogs().length > 0}
          fallback={<Text color="fg.muted">No HEIC runs yet.</Text>}
        >
          <For each={heicRunLogs()}>
            {(log) => (
              <Box borderTopWidth="1px" borderColor="gray.outline.border" pt="2" mt="2">
                <Text textStyle="xs" color="fg.muted">
                  {formatUtcTimestamp(log.at)}
                </Text>
                <Text textStyle="sm">
                  {log.result.dryRun ? "Dry run" : "Live run"}: updated{" "}
                  {log.result.updatedDocs}, transcoded{" "}
                  {log.result.transcodedImages}, failures{" "}
                  {log.result.failures.length}
                </Text>
              </Box>
            )}
          </For>
        </Show>
      </Box>

      <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l3" p="4">
        <Heading as="h2" fontSize="lg" mb="3">
          Recent Backups (30 Most Recent Docs)
        </Heading>
        <Suspense fallback={<Text color="fg.muted">Loading backup list…</Text>}>
          <Show when={recentBackups()?.length} fallback={<Text color="fg.muted">No backup rows yet.</Text>}>
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Updated</Table.Header>
                  <Table.Header>Title</Table.Header>
                  <Table.Header>ID</Table.Header>
                  <Table.Header>Action</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={recentBackups()!}>
                  {(doc) => (
                    <Table.Row>
                      <Table.Cell>{formatUtcTimestamp(doc.updatedAt)}</Table.Cell>
                      <Table.Cell>
                        <DocHoverPreviewLink
                          href={`/docs/${doc.id}`}
                          title={doc.title}
                          updatedAt={doc.updatedAt}
                          path={doc.path}
                          meta={doc.meta}
                          snippet={doc.snippet}
                          triggerClass={titleLinkClass}
                        >
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            _hover={{ textDecoration: "underline" }}
                          >
                            {doc.title}
                          </Text>
                        </DocHoverPreviewLink>
                      </Table.Cell>
                      <Table.Cell>{doc.id}</Table.Cell>
                      <Table.Cell>
                        <Tooltip
                          content="Restore this note's original pre-migration content from backup."
                          showArrow
                        >
                          <Button
                            size="xs"
                            variant="outline"
                            loading={recoveringDocId() === doc.id}
                            disabled={
                              Boolean(recoveringDocId()) && recoveringDocId() !== doc.id
                            }
                            onClick={() => void recoverDoc(doc.id)}
                          >
                            Recover
                          </Button>
                        </Tooltip>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Table.Body>
            </Table.Root>
          </Show>
        </Suspense>
      </Box>

      <Box borderWidth="1px" borderColor="gray.outline.border" borderRadius="l3" p="4">
        <Heading as="h2" fontSize="lg" mb="3">
          Images On Disk (10 Biggest Files)
        </Heading>
        <Suspense fallback={<Text color="fg.muted">Loading image storage inventory…</Text>}>
          <Show when={imageStorageStatus()}>
            {(s) => (
              <Stack gap="3">
                <HStack gap="4" flexWrap="wrap">
                  <Text textStyle="sm" color="fg.muted">
                    Directory: <Box as="code">{s().storageDir}</Box>
                  </Text>
                  <Text textStyle="sm" color="fg.muted">
                    Exists: {s().dirExists ? "Yes" : "No"}
                  </Text>
                  <Text textStyle="sm" color="fg.muted">
                    Files: {s().fileCount}
                  </Text>
                  <Text textStyle="sm" color="fg.muted">
                    Total Size: {formatBytes(s().totalBytes)}
                  </Text>
                </HStack>
                <Show
                  when={s().files.length > 0}
                  fallback={<Text color="fg.muted">No image files found.</Text>}
                >
                  <Text textStyle="xs" color="fg.muted">
                    Showing the {s().files.length} largest files by size.
                  </Text>
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.Header>File / URL</Table.Header>
                        <Table.Header>Size</Table.Header>
                        <Table.Header>Updated</Table.Header>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      <For each={s().files}>
                        {(file) => (
                          <Table.Row>
                            <Table.Cell>
                              <Link
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {file.name}
                              </Link>
                            </Table.Cell>
                            <Table.Cell>
                              {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} B)
                            </Table.Cell>
                            <Table.Cell>{formatUtcTimestamp(file.updatedAt)}</Table.Cell>
                          </Table.Row>
                        )}
                      </For>
                    </Table.Body>
                  </Table.Root>
                </Show>
              </Stack>
            )}
          </Show>
        </Suspense>
      </Box>
    </Stack>
  );
};

const AdminMigrationsRoute: VoidComponent = () => {
  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="6" px="4" maxW="1200px">
        <ErrorBoundary fallback={<Text color="red.10">Failed to render migration admin panel.</Text>}>
          <MigrationPanel />
        </ErrorBoundary>
      </Container>
    </Box>
  );
};

export default AdminMigrationsRoute;
