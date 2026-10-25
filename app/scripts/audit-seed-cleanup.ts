/**
 * Seeds an audit database with synthetic notes shaped like the cleanup
 * archetypes (ChatGPT transcripts, agent digests, passed events, to-do notes,
 * stubs, import hubs, real logs), assesses them with the heuristic provider,
 * and archives a few so the archive page has a countdown to show.
 *
 *   pnpm audit:db -- --owner <slug> --seed-cleanup
 *
 * Rerunning replaces the previous cleanup seed (notes with meta seed=cleanup).
 */
import { prisma } from "~/server/db";
import { createNoteRecord } from "~/server/notes/create-note";
import { assessDoc } from "~/server/cleanup/assess";
import { heuristicDecider } from "~/server/cleanup/heuristic";

const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
if (!databaseName.startsWith("visual_notes_audit_")) {
  console.error(
    "[audit-seed] DATABASE_URL must name a visual_notes_audit_ database.",
  );
  process.exit(1);
}

const SEED_META = { seed: "cleanup" };
const DAY_MS = 24 * 60 * 60_000;
const chat = (turns: Array<[string, string]>, id: string) =>
  `${turns.map(([q, a]) => `**You:** ${q}\n\n**ChatGPT:** ${a}`).join("\n\n")}\n\nLink back: https://chatgpt.com/c/${id}`;

type SeedNote = {
  key: string;
  title: string;
  path?: string;
  markdown: string;
  ageDays: number;
  agent?: boolean;
};

const NOTES: SeedNote[] = [
  {
    key: "css-motion",
    title: "CSS motion",
    path: "css",
    ageDays: 400,
    markdown:
      "My working notes on motion in this app.\n\n## What I use\n\n- I keep hover transitions at 150ms.\n- I used `prefers-reduced-motion` on the sidebar after the vestibular complaint.\n",
  },
  {
    key: "css-anim",
    title: "CSS Animations and Transitions",
    path: "css",
    ageDays: 520,
    markdown: chat(
      [
        [
          "Can you explain the difference between CSS transitions and animations? When should I use each?",
          "Great question! Transitions are best for simple state changes, where you have a clear start and end state, such as a hover effect or toggling a class. You define the property, duration, and easing, and the browser interpolates the values.\n\nAnimations are more powerful. They use keyframes to define multiple steps, which is useful for complex or repeating motion like a loading spinner.",
        ],
        [
          "Which properties are best to animate?",
          "Properties like transform and opacity are usually the best choices because they can be animated on the compositor thread, which avoids layout and paint. Properties that trigger layout, like width, height, top, or left, can be more expensive.",
        ],
        [
          "Any recommendations for easing and timing?",
          "A good default is ease-out, which starts quickly and slows down at the end. Keep durations short, typically 100–300ms. Also respect the prefers-reduced-motion media query.\n\n```css\n.panel { transition: transform 200ms ease-out; }\n```",
        ],
      ],
      "css-anim",
    ),
  },
  {
    key: "csv",
    title: "JS Libraries for CSV conversion",
    path: "js",
    ageDays: 960,
    markdown: chat(
      [
        [
          "What are good JavaScript libraries for reading and writing CSV?",
          "Here are some popular options:\n\n1. **PapaParse**: well maintained, works in the browser and Node.js, supports streaming and large files.\n2. **csv-parse / csv-stringify**: part of the node-csv project, great for Node streams.\n3. **jQuery-CSV**: older, depends on jQuery.\n\n```js\nPapa.parse(file, { header: true, complete: (r) => console.log(r.data) })\n```",
        ],
      ],
      "csv",
    ),
  },
  {
    key: "jsonb",
    title: "Postgres JSONB indexing tips",
    path: "db",
    ageDays: 640,
    markdown: chat(
      [
        [
          "How should I index a JSONB column in Postgres?",
          "Use a GIN index for containment queries (`@>`), and the `jsonb_path_ops` operator class when you only need containment, since it is smaller and faster. For a single key you filter on often, an expression index like `CREATE INDEX ON t ((data->>'status'))` works well.",
        ],
      ],
      "jsonb",
    ),
  },
  {
    key: "bash",
    title: "Bash parameter expansion",
    path: "shell",
    ageDays: 1100,
    markdown: chat(
      [
        [
          "Explain bash parameter expansion.",
          "Parameter expansion lets you transform variables inline: `${var:-default}` uses a default, `${var#prefix}` strips a prefix, `${var%suffix}` strips a suffix, and `${#var}` gives the length.",
        ],
      ],
      "bash",
    ),
  },
  {
    key: "digest",
    title: "AI reading digest, September",
    path: "reading",
    ageDays: 40,
    agent: true,
    markdown:
      "## Highlights\n\n- A survey of small decision models compared typed outputs with LLM judges across 27 tasks.\n- A post on retrieval evaluation argued for per-query metrics over averages.\n- A benchmark of embedding models found little gain past 1,024 dimensions for short notes.\n\n## Links\n\n- Decision models as rubric judges\n- Retrieval evaluation in practice\n",
  },
  {
    key: "camp",
    title: "Cub Scout Camping Trip",
    path: "family.scouts",
    ageDays: 70,
    markdown:
      "Pack camping trip on Sep 13, 2026 at the county park.\n\n## Carpool\n\n- Friday 4pm leave from school lot\n- RSVP by Sep 6, 2026\n\n## Packing list\n\n- Tent, sleeping bag, pad\n- Headlamp and spare batteries\n- Rain jacket\n\n## Campsite contacts\n\n- Ranger station: front gate\n\n## Next time\n\n- Bring a second tarp; the site floods near the fire ring.\n",
  },
  {
    key: "festival",
    title: "Fall festival tickets",
    path: "family",
    ageDays: 45,
    markdown:
      "Festival on Oct 4, 2026. Tickets bought for four, parking pass printed. Event gates open at 10am.\n",
  },
  {
    key: "finance",
    title: "Finance quick plan",
    ageDays: 12,
    markdown:
      "- [ ] Call the bank about the escrow change\n- [ ] Move the emergency fund to the high-yield account\n- [ ] Cancel the old streaming plan\n",
  },
  {
    key: "voice",
    title: "Voice note · Oct 21 at 1:39 PM",
    ageDays: 4,
    markdown: " ",
  },
  {
    key: "hub",
    title: "js",
    path: "js",
    ageDays: 1200,
    markdown:
      "- [js react](__NOTION__js%20react.md)\n- [js yarn](__NOTION__js%20yarn.md)\n- [js regex](__NOTION__js%20regex.md)\n- [js ts hoc](__NOTION__js%20ts%20hoc.md)\n",
  },
  {
    key: "timeline",
    title: "House Work Timeline",
    path: "house",
    ageDays: 700,
    markdown:
      "My running log of work on the house.\n\n| Date | Work | Notes |\n| --- | --- | --- |\n| 2025-04-02 | Replaced the garage GFCI | I traced the tripping to the freezer circuit |\n| 2025-06-18 | Sealed the deck | Two coats; I used the semi-transparent stain |\n| 2026-03-09 | New bathroom fan motor | My measurements: 70 CFM, 4in duct |\n",
  },
  {
    key: "cabinet",
    title: "Woodshop cabinet build",
    path: "woodwork",
    ageDays: 210,
    markdown:
      "I built the wall cabinet from 3/4in birch ply.\n\n- My dado depth: 1/4in on the table saw\n- I glued the face frame before hanging the doors\n- Next time I would pre-finish the inside panels\n",
  },
  {
    key: "slide",
    title: "CSS slide effect",
    path: "css",
    ageDays: 480,
    markdown: chat(
      [
        [
          "How do I make a panel slide in from the right?",
          "Use a transform: start at `translateX(100%)` and transition to `translateX(0)` with `transition: transform 250ms ease-out`. Toggle a class to trigger it.",
        ],
      ],
      "slide",
    ),
  },
];

/** Archived seed notes: [key, days ago archived, reason, into key]. */
const ARCHIVED: Array<[string, string, number, string, string | null]> = [
  ["old-router", "React Router v5 nested routes", 27, "distill", "css-motion"],
  ["backup-draft", "Backup script draft", 5, "delete", null],
  ["css-removal", "CSS animation on removal", 12, "combine", "css-motion"],
];

const previous = await prisma.doc.findMany({
  where: { meta: { path: ["seed"], equals: "cleanup" } },
  select: { id: true },
});
if (previous.length) {
  await prisma.doc.deleteMany({
    where: { id: { in: previous.map((d) => d.id) } },
  });
  console.info(`[audit-seed] removed ${previous.length} earlier cleanup notes`);
}

const ids = new Map<string, string>();
const now = Date.now();
for (const note of NOTES) {
  const { id } = await createNoteRecord({
    title: note.title,
    markdown: note.markdown,
    path: note.path,
    meta: SEED_META,
  });
  ids.set(note.key, id);
  const created = new Date(now - note.ageDays * DAY_MS);
  await prisma.doc.update({
    where: { id },
    data: { createdAt: created, updatedAt: created },
  });
  if (note.agent) {
    await prisma.actionEvent.updateMany({
      where: { relatedDocId: id, eventType: "doc.create" },
      data: { actorType: "chatgpt" },
    });
  }
}
for (const [key, title, ago, reason, into] of ARCHIVED) {
  const { id } = await createNoteRecord({
    title,
    markdown: `Archived seed note for ${title}.`,
    meta: SEED_META,
  });
  ids.set(key, id);
  await prisma.doc.update({
    where: { id },
    data: {
      archivedAt: new Date(now - ago * DAY_MS),
      archiveReason: reason,
      archivedIntoId: into ? ids.get(into) : null,
    },
  });
}

for (const note of NOTES) {
  await assessDoc(ids.get(note.key)!, heuristicDecider);
}
const buckets = await prisma.noteAssessment.groupBy({
  by: ["bucket"],
  _count: { _all: true },
});
console.info(
  `[audit-seed] buckets ${buckets.map((b) => `${b.bucket}=${b._count._all}`).join(" ")}`,
);
console.info(
  `[audit-seed] seeded ${NOTES.length + ARCHIVED.length} cleanup notes into ${databaseName}`,
);
await prisma.$disconnect();
