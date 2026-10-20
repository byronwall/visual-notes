import { action, json, query } from "@solidjs/router";
import {
  countUnmigratedNotes,
  runBlockMigrationBatch,
  type BlockMigrationBatch,
} from "~/server/notes/block-migration";

export type { BlockMigrationBatch };

export const fetchBlockMigrationCounts = query(async () => {
  "use server";
  return countUnmigratedNotes();
}, "admin-block-migration-counts");

export const runBlockMigration = action(
  async (input: { dryRun: boolean; cursor?: string | null }) => {
    "use server";
    const batch = await runBlockMigrationBatch({
      dryRun: input.dryRun,
      cursor: input.cursor ?? null,
    });
    return json(batch, { revalidate: [fetchBlockMigrationCounts.key] });
  },
  "admin-block-migration-run",
);

export const rebuildBlockIndex = action(async () => {
  "use server";
  const { reindexAllNotes } = await import("~/server/notes/note-index");
  return { reindexed: await reindexAllNotes() };
}, "admin-block-index-rebuild");
