// Seeds four synthetic collections (Reading, Projects, People, Research) into
// an audit database. Refuses any database whose name does not start with
// `visual_notes_audit_`.
//
//   node --experimental-strip-types --env-file=.env scripts/seed-collections.ts [--reset]
//   pnpm migrate:blocks --apply   # then convert the seeded HTML bodies to blocks
import { PrismaClient } from "@prisma/client";
import { rankBetween } from "../src/lib/collections/rank.ts";

const SEED_MARK = "[seed:collections]";

function databaseUrl(): string {
  const env = process.env;
  const name = env.DB_NAME ?? "";
  if (!name.startsWith("visual_notes_audit_")) {
    throw new Error(`Refusing to seed database "${name}": name must start with visual_notes_audit_`);
  }
  const host = env.DB_HOST ?? "localhost";
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`Refusing non-loopback host ${host}`);
  const user = encodeURIComponent(env.DB_USER ?? "postgres");
  const pass = encodeURIComponent(env.DB_PASSWORD ?? "");
  return `postgresql://${user}:${pass}@${host}:${env.DB_PORT ?? "5432"}/${name}?schema=public`;
}

// Small deterministic PRNG so fixtures are stable between runs.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const pickSome = <T>(items: readonly T[], max: number) =>
  [...new Set(Array.from({ length: 1 + Math.floor(rand() * max) }, () => pick(items)))];
const pad = (n: number) => String(n).padStart(2, "0");
const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type OptionColor = "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";
const COLORS: OptionColor[] = ["blue", "green", "orange", "purple", "pink", "yellow", "red", "brown", "gray"];
let optionCounter = 0;
const options = (names: string[], groups?: Array<"todo" | "doing" | "done">) =>
  names.map((name, i) => ({
    id: `opt_seed${optionCounter++}`,
    name,
    color: groups ? (["gray", "blue", "green"] as const)[["todo", "doing", "done"].indexOf(groups[i]!)]! : COLORS[i % COLORS.length]!,
    ...(groups ? { group: groups[i] } : {}),
  }));

const cover = (hue: number, label: string) =>
  `<p><img src="data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='600' height='360' fill='hsl(${hue} 45% 55%)'/><text x='40' y='200' font-family='Georgia' font-size='48' fill='white'>${label}</text></svg>`,
  )}" alt="${label} cover"></p>`;

type PropSpec = { key: string; name: string; kind: string; config?: Record<string, unknown> };

async function createCollection(
  prisma: PrismaClient,
  name: string,
  icon: string,
  specs: PropSpec[],
  views: Array<{ name: string; type: "table" | "board" | "gallery" | "calendar"; config?: (ids: Record<string, string>) => Record<string, unknown> }>,
  rows: Array<{ title: string; values: (ids: Record<string, string>, opts: Record<string, Array<{ id: string; name: string }>>) => Record<string, unknown>; html: string }>,
) {
  const collection = await prisma.collection.create({ data: { name, icon, description: SEED_MARK } });
  const ids: Record<string, string> = {};
  const opts: Record<string, Array<{ id: string; name: string }>> = {};
  for (const [position, spec] of specs.entries()) {
    const created = await prisma.collectionProperty.create({
      data: { collectionId: collection.id, name: spec.name, kind: spec.kind as never, position, config: (spec.config ?? {}) as never },
    });
    ids[spec.key] = created.id;
    opts[spec.key] = ((spec.config?.options as Array<{ id: string; name: string }>) ?? []);
  }
  for (const [position, view] of views.entries()) {
    await prisma.collectionView.create({
      data: { collectionId: collection.id, name: view.name, type: view.type, position, config: (view.config?.(ids) ?? {}) as never },
    });
  }
  let rank: string | null = null;
  const batch = rows.map((row) => {
    rank = rankBetween(rank, null);
    return {
      title: row.title,
      markdown: "",
      html: row.html,
      collectionId: collection.id,
      collectionRank: rank,
      properties: row.values(ids, opts) as never,
    };
  });
  for (let i = 0; i < batch.length; i += 500) {
    await prisma.doc.createMany({ data: batch.slice(i, i + 500) });
  }
  console.info("[seed-collections] %s: %d rows (%s)", name, rows.length, collection.id);
  return collection.id;
}

const optId = (list: Array<{ id: string; name: string }>, name: string) => list.find((o) => o.name === name)!.id;

async function main() {
  const reset = process.argv.includes("--reset");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  try {
    const existing = await prisma.collection.findMany({ where: { description: SEED_MARK }, select: { id: true } });
    if (existing.length && !reset) {
      console.info("[seed-collections] already seeded (%d). Pass --reset to rebuild.", existing.length);
      return;
    }
    for (const c of existing) {
      await prisma.doc.deleteMany({ where: { collectionId: c.id } });
      await prisma.collection.delete({ where: { id: c.id } });
    }

    // Reading list
    const readingStatus = options(["Want to read", "Reading", "Finished", "Abandoned"], ["todo", "doing", "done", "done"]);
    const genres = options(["Fiction", "History", "Science", "Design", "Philosophy", "Business", "Poetry", "Biography"]);
    const formats = options(["Book", "Paper", "Article", "Audiobook"]);
    const authors = ["Le Guin", "Calvino", "Gawande", "Tufte", "Norman", "Didion", "Sagan", "Morrison", "Borges", "Rovelli", "Hofstadter", "Kahneman"];
    const nouns = ["River", "Garden", "Signal", "Archive", "Atlas", "Lantern", "Harbor", "Engine", "Orchard", "Mirror", "Compass", "Ledger"];
    const adjectives = ["Quiet", "Invisible", "Patient", "Second", "Hidden", "Distant", "Small", "Bright", "Last", "Open"];
    await createCollection(
      prisma,
      "Reading",
      "📚",
      [
        { key: "status", name: "Status", kind: "status", config: { options: readingStatus } },
        { key: "author", name: "Author", kind: "text", config: { format: "plain" } },
        { key: "rating", name: "Rating", kind: "number", config: { format: "rating", ratingMax: 5 } },
        { key: "genre", name: "Genre", kind: "multi_select", config: { options: genres } },
        { key: "format", name: "Format", kind: "select", config: { options: formats } },
        { key: "finished", name: "Finished", kind: "date", config: {} },
        { key: "url", name: "Link", kind: "text", config: { format: "url" } },
        { key: "pages", name: "Pages", kind: "number", config: { format: "plain" } },
        { key: "owned", name: "Owned", kind: "checkbox", config: {} },
      ],
      [
        { name: "All books", type: "table" },
        { name: "By status", type: "board", config: (ids) => ({ groupBy: ids.status, cardProperties: [ids.author, ids.rating] }) },
        { name: "Shelf", type: "gallery", config: (ids) => ({ cover: { source: "body" }, cardProperties: [ids.author, ids.rating] }) },
        { name: "Finished dates", type: "calendar", config: (ids) => ({ dateProperty: ids.finished }) },
      ],
      Array.from({ length: 300 }, (_, i) => {
        const title = `The ${pick(adjectives)} ${pick(nouns)}${i % 7 === 0 ? ` ${i}` : ""}`;
        const status = pick(readingStatus);
        const hue = Math.floor(rand() * 360);
        return {
          title,
          html: `${i % 3 === 0 ? cover(hue, title.replace(/^The /, "")) : ""}<p>Notes on <em>${title}</em>. ${pick(["Slow start, strong finish.", "Lent to a friend.", "Re-read the middle chapters.", "Quotes worth keeping below.", "Recommended by the newsletter."])}</p>`,
          values: (ids) => ({
            [ids.status!]: status.id,
            [ids.author!]: pick(authors),
            ...(status.group === "done" ? { [ids.rating!]: 1 + Math.floor(rand() * 5), [ids.finished!]: { start: dayOffset(-Math.floor(rand() * 120)) } } : {}),
            [ids.genre!]: pickSome(genres, 2).map((g) => g.id),
            [ids.format!]: pick(formats).id,
            ...(rand() > 0.4 ? { [ids.url!]: `https://example.com/books/${i}` } : {}),
            [ids.pages!]: 120 + Math.floor(rand() * 600),
            ...(rand() > 0.5 ? { [ids.owned!]: true } : {}),
          }),
        };
      }),
    );

    // Projects
    const projectStatus = options(["Backlog", "Planned", "Active", "Blocked", "Shipped"], ["todo", "todo", "doing", "doing", "done"]);
    const areas = options(["Product", "Infra", "Writing", "Home", "Research"]);
    const priority = options(["Low", "Medium", "High", "Urgent"]);
    const verbs = ["Ship", "Draft", "Migrate", "Plan", "Review", "Rebuild", "Polish", "Prototype", "Launch", "Audit"];
    const things = ["onboarding", "pricing page", "search", "garden beds", "quarterly letter", "backup system", "mobile layout", "reading notes", "design system", "tax prep"];
    await createCollection(
      prisma,
      "Projects",
      "🗂️",
      [
        { key: "status", name: "Status", kind: "status", config: { options: projectStatus } },
        { key: "area", name: "Area", kind: "select", config: { options: areas } },
        { key: "priority", name: "Priority", kind: "select", config: { options: priority } },
        { key: "due", name: "Timeline", kind: "date", config: {} },
        { key: "progress", name: "Progress", kind: "number", config: { format: "progress" } },
        { key: "budget", name: "Budget", kind: "number", config: { format: "currency", currency: "USD" } },
      ],
      [
        { name: "Board", type: "board", config: (ids) => ({ groupBy: ids.status, cardProperties: [ids.area, ids.priority, ids.due] }) },
        { name: "Table", type: "table" },
        { name: "Timeline", type: "calendar", config: (ids) => ({ dateProperty: ids.due }) },
      ],
      Array.from({ length: 60 }, () => {
        const start = Math.floor(rand() * 50) - 20;
        const length = Math.floor(rand() * 10);
        const status = pick(projectStatus);
        return {
          title: `${pick(verbs)} ${pick(things)}`,
          html: `<h2>Goal</h2><p>${pick(["Reduce friction for new users.", "Get the first version in front of people.", "Clear out the backlog before the holidays."])}</p><ul><li><p>First step</p></li><li><p>Second step</p></li></ul>`,
          values: (ids) => ({
            [ids.status!]: status.id,
            [ids.area!]: pick(areas).id,
            [ids.priority!]: pick(priority).id,
            [ids.due!]: length > 0 ? { start: dayOffset(start), end: dayOffset(start + length) } : { start: dayOffset(start) },
            [ids.progress!]: status.group === "done" ? 1 : Math.round(rand() * 10) / 10,
            ...(rand() > 0.5 ? { [ids.budget!]: Math.round(rand() * 5000) } : {}),
          }),
        };
      }),
    );

    // People
    const relationship = options(["Friend", "Colleague", "Client", "Mentor", "Family"]);
    const companies = ["Northwind", "Acme", "Globex", "Initech", "Umbrella", "Stark", "Wayne", "Hooli"];
    const first = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Katherine", "Dennis", "Barbara", "Ken", "Radia", "Tim", "Frances"];
    const last = ["Lovelace", "Hopper", "Torvalds", "Hamilton", "Turing", "Johnson", "Ritchie", "Liskov", "Thompson", "Perlman", "Berners", "Allen"];
    await createCollection(
      prisma,
      "People",
      "👥",
      [
        { key: "company", name: "Company", kind: "text", config: { format: "plain" } },
        { key: "rel", name: "Relationship", kind: "select", config: { options: relationship } },
        { key: "email", name: "Email", kind: "text", config: { format: "email" } },
        { key: "phone", name: "Phone", kind: "text", config: { format: "phone" } },
        { key: "last", name: "Last contact", kind: "date", config: {} },
        { key: "follow", name: "Follow up", kind: "checkbox", config: {} },
      ],
      [
        { name: "Everyone", type: "table" },
        { name: "Cards", type: "gallery", config: (ids) => ({ cover: { source: "none" }, cardProperties: [ids.company, ids.rel, ids.last] }) },
        { name: "Last contact", type: "calendar", config: (ids) => ({ dateProperty: ids.last }) },
      ],
      Array.from({ length: 120 }, (_, i) => {
        const f = pick(first);
        const l = pick(last);
        return {
          title: `${f} ${l}`,
          html: `<p>Met at ${pick(["a conference", "the meetup", "a friend's dinner", "work"])}. Talked about ${pick(["compilers", "gardening", "climbing", "typography", "chess"])}.</p>`,
          values: (ids) => ({
            [ids.company!]: pick(companies),
            [ids.rel!]: pick(relationship).id,
            [ids.email!]: `${f.toLowerCase()}.${l.toLowerCase()}${i}@example.com`,
            ...(rand() > 0.5 ? { [ids.phone!]: `+1 555 01${pad(i % 100)}` } : {}),
            [ids.last!]: { start: dayOffset(-Math.floor(rand() * 90)) },
            ...(rand() > 0.7 ? { [ids.follow!]: true } : {}),
          }),
        };
      }),
    );

    // Research (performance gate: 2,000 rows)
    const sourceType = options(["Paper", "Blog post", "Talk", "Dataset", "Thread"]);
    const topics = options(["Embeddings", "Search", "UX", "Databases", "Sync", "Editors", "Visualization", "Agents", "Privacy", "Caching"]);
    const stage = options(["Inbox", "Skimmed", "Read", "Synthesized"], ["todo", "doing", "done", "done"]);
    const subjects = ["vector search", "CRDT merges", "fractional indexing", "query planners", "local-first apps", "graph layouts", "prompt caching", "virtual lists"];
    await createCollection(
      prisma,
      "Research",
      "🔬",
      [
        { key: "stage", name: "Stage", kind: "status", config: { options: stage } },
        { key: "type", name: "Type", kind: "select", config: { options: sourceType } },
        { key: "topics", name: "Topics", kind: "multi_select", config: { options: topics } },
        { key: "year", name: "Year", kind: "number", config: { format: "plain" } },
        { key: "added", name: "Added", kind: "date", config: {} },
        { key: "url", name: "Source", kind: "text", config: { format: "url" } },
        { key: "score", name: "Relevance", kind: "number", config: { format: "percent" } },
      ],
      [
        { name: "All sources", type: "table" },
        { name: "Pipeline", type: "board", config: (ids) => ({ groupBy: ids.stage, cardProperties: [ids.type, ids.topics] }) },
      ],
      Array.from({ length: 2000 }, (_, i) => ({
        title: `${pick(["On", "Notes on", "Revisiting", "A survey of", "Why"])} ${pick(subjects)} ${i + 1}`,
        html: `<p>${pick(["Key claim:", "Takeaway:", "Open question:"])} ${pick(subjects)} ${pick(["scales better than expected", "needs a benchmark", "conflicts with prior results"])}.</p>`,
        values: (ids) => ({
          [ids.stage!]: pick(stage).id,
          [ids.type!]: pick(sourceType).id,
          [ids.topics!]: pickSome(topics, 3).map((t) => t.id),
          [ids.year!]: 2005 + Math.floor(rand() * 21),
          [ids.added!]: { start: dayOffset(-Math.floor(rand() * 365)) },
          [ids.url!]: `https://example.org/papers/${i}`,
          [ids.score!]: Math.round(rand() * 100) / 100,
        }),
      })),
    );
    void optId;
    console.info("[seed-collections] done. Run `pnpm migrate:blocks --apply` to give the rows block bodies.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-collections] failed", error);
  process.exitCode = 1;
});
