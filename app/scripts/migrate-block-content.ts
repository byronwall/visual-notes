/**
 * Local CLI for the block-content migration (production uses the admin
 * Migrations page, which calls the same code).
 *
 *   pnpm migrate:blocks --dry-run      # report only, writes nothing
 *   pnpm migrate:blocks --apply        # convert every unmigrated note
 *   pnpm migrate:blocks --reindex      # rebuild block/link index for all notes
 *
 * Prints notes losing more than 2% of their visible text.
 */
import { writeFileSync } from "node:fs";
import {
  countUnmigratedNotes,
  runBlockMigrationBatch,
  type BlockMigrationRow,
} from "~/server/notes/block-migration";

const args = new Set(process.argv.slice(2));
if (args.has("--reindex")) {
  const { reindexAllNotes } = await import("~/server/notes/note-index");
  const count = await reindexAllNotes();
  console.info(`[block-migration] reindexed ${count} notes`);
  process.exit(0);
}
const apply = args.has("--apply");
if (!apply && !args.has("--dry-run")) {
  console.error("Pass --dry-run or --apply");
  process.exit(1);
}

const rows: BlockMigrationRow[] = [];
let cursor: string | null = null;
for (;;) {
  const batch = await runBlockMigrationBatch({
    dryRun: !apply,
    limit: 200,
    cursor,
  });
  rows.push(...batch.rows);
  if (batch.processed === 0) break;
  if (apply ? batch.remaining === 0 || batch.migrated === 0 : !batch.nextCursor)
    break;
  cursor = batch.nextCursor;
}

const lossy = rows.filter((r) => r.lossPct > 2 || r.error);
const counts = await countUnmigratedNotes();
console.info(
  `[block-migration] ${apply ? "applied" : "dry run"}: ${rows.length} notes, ${lossy.length} lossy (>2%) or failed; ${counts.remaining}/${counts.total} still unmigrated`,
);
for (const r of lossy) {
  console.info(
    `  ${r.id}  ${r.lossPct}%  ${r.beforeChars}->${r.afterChars}  ${r.title}${r.error ? `  ERROR ${r.error}` : ""}`,
  );
}
const reportPath = process.env.BLOCK_MIGRATION_REPORT;
if (reportPath) {
  writeFileSync(reportPath, JSON.stringify(rows, null, 2));
  console.info(`[block-migration] report written to ${reportPath}`);
}
process.exit(0);
