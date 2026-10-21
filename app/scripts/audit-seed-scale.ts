/**
 * Seeds an audit database with production-scale synthetic notes.
 *
 *   pnpm audit:seed-scale -- --notes 6000 [--legacy-share 0.5] [--seed 1]
 *
 * Run it through `pnpm audit:db -- --owner <slug> --seed-scale 6000`, which
 * points DATABASE_URL at that owner's synthetic database. Legacy notes get
 * only markdown/html (content NULL), like unmigrated production rows; the
 * rest go through the note store with blocks and a block index.
 */
import { parseArgs } from "node:util";
import { prisma } from "~/server/db";
import { createNoteRecord } from "~/server/notes/create-note";
import {
  seededRandom,
  syntheticNote,
} from "~/server/notes/imported-markdown-corpus";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    notes: { type: "string" },
    "legacy-share": { type: "string", default: "0.5" },
    seed: { type: "string", default: "1" },
  },
  strict: true,
});

const total = Number(values.notes);
const legacyShare = Number(values["legacy-share"]);
const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
if (!databaseName.startsWith("visual_notes_audit_")) {
  console.error(
    "[audit-seed] DATABASE_URL must name a visual_notes_audit_ database.",
  );
  process.exit(1);
}
if (
  !Number.isInteger(total) ||
  total < 1 ||
  !(legacyShare >= 0 && legacyShare <= 1)
) {
  console.error(
    "[audit-seed] Use --notes <count> [--legacy-share 0..1] [--seed n].",
  );
  process.exit(1);
}

const random = seededRandom(Number(values.seed));
const started = Date.now();
const batchSize = 100;
let legacy = 0;
for (let offset = 0; offset < total; offset += batchSize) {
  const notes = Array.from(
    { length: Math.min(batchSize, total - offset) },
    (_, i) => syntheticNote(offset + i, random),
  );
  const legacyCount = Math.round(notes.length * legacyShare);
  await prisma.doc.createMany({
    data: notes.slice(0, legacyCount).map((note) => ({
      title: note.title,
      markdown: note.markdown,
      html: normalizeMarkdownToHtml(note.markdown),
      path: "audit.scale",
    })),
  });
  legacy += legacyCount;
  for (const note of notes.slice(legacyCount)) {
    await createNoteRecord({ ...note, path: "audit.scale" });
  }
  console.info(`[audit-seed] ${offset + notes.length}/${total} notes`);
}
console.info(
  `[audit-seed] seeded ${total} notes (${legacy} legacy, ${total - legacy} blocks) into ${databaseName} in ${Math.round((Date.now() - started) / 1000)}s`,
);
await prisma.$disconnect();
