export const GITHUB = "https://github.com/byronwall/visual-notes";
export const BYRON = "https://byroni.us";

/** A numbered marker on a screenshot. x and y are percentages of the image. */
export type Callout = { x: number; y: number; text: string };

export type Stop = {
  id: string;
  tab: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  callouts: Callout[];
};

// Screenshots are 2368×1800 (the app at 1440×900, 2x, sidebar cropped out).
// Callout positions were read off those images; recheck them after a reshoot.
export const TOUR: Stop[] = [
  {
    id: "voice",
    tab: "Voice memos",
    title: "Talk on a walk, get a note back",
    body: "Record on a note or drop a memo in. Whisper transcribes it, then a planning pass writes the summary, splits the transcript into titled sections, and pulls out the tasks.",
    image: "voice",
    alt: "A note with a recording, a short summary, three extracted tasks, and a transcript split into three titled sections",
    callouts: [
      { x: 16.5, y: 18, text: "The recording stays on the note it belongs to" },
      { x: 16.5, y: 34, text: "Tasks come out with the time you said them" },
      {
        x: 16.5,
        y: 48,
        text: "The transcript is split into titled, timed sections, and all of it is searchable",
      },
    ],
  },
  {
    id: "write",
    tab: "Writing",
    title: "A plain editor that saves as you type",
    body: "Notes are markdown stored as blocks, filed by dot path. Every block has an ID, so an agent can change one paragraph without rewriting the note.",
    image: "editor",
    alt: "A note filed under work.canvas.perf with a measurements table, a numbered plan, a code block, and task checkboxes",
    callouts: [
      { x: 15, y: 3.5, text: "Filed by path, like work.canvas.perf, with tags inline" },
      { x: 16.5, y: 41.5, text: "Tables, code, and checklists are ordinary blocks" },
      { x: 81, y: 23.5, text: "Contents are built from the headings" },
    ],
  },
  {
    id: "tasks",
    tab: "Tasks",
    title: "Tasks stay where you wrote them",
    body: "A checkbox in a note is a real task. They all collect into one inbox with lists and due days, and each one links back to the note that holds its context.",
    image: "tasks",
    alt: "The task inbox with 54 open tasks, each linked back to the note that holds it",
    callouts: [
      { x: 20, y: 9.6, text: "Quick add takes #tag, @day, and ~duration" },
      { x: 58.5, y: 29.8, text: "Every task links back to its note" },
      { x: 15.5, y: 6.8, text: "Lists, plus a view of only the tasks written in notes" },
    ],
  },
  {
    id: "collections",
    tab: "Collections",
    title: "Tables where every row is a note",
    body: "Collections have typed properties: dates, places, prices, decisions. Show one as a table, board, gallery, or calendar, or embed a live view inside a note.",
    image: "collection",
    alt: "A Date Nights collection shown as a table with category, price, next show, place, and decision columns",
    callouts: [
      { x: 13, y: 11.8, text: "Table, board, gallery, and calendar views of the same rows" },
      { x: 63.5, y: 16.6, text: "Typed properties: dates, places, prices" },
      { x: 92, y: 44.5, text: "A decision on each row, so the list doubles as a plan" },
    ],
  },
  {
    id: "research",
    tab: "Research",
    title: "Research opens as a map",
    body: "A topic holds criteria, options, questions, tasks, notes, and sources. A comment on a card is addressed to the agent, so the next research run picks it up as an instruction.",
    image: "research",
    alt: "A research topic on learning async Rust, expanded into options, questions with answers, tasks, notes, and sources",
    callouts: [
      { x: 22, y: 50.5, text: "The topic sits at the center of the map" },
      { x: 56, y: 37.5, text: "Cards are grouped: criteria, options, questions, tasks, notes, sources" },
      { x: 76.6, y: 57.6, text: "Answers hang off the question they settle" },
    ],
  },
  {
    id: "canvas",
    tab: "Canvas",
    title: "See what you have been writing about",
    body: "Embeddings and UMAP place every note by similarity, and the canvas names the regions it finds. This is the view that gave the app its name.",
    image: "canvas",
    alt: "The canvas with six labeled regions of notes and a side panel that summarizes each region",
    callouts: [
      { x: 24.4, y: 28.8, text: "Notes placed by embedding similarity" },
      { x: 75, y: 10.7, text: "Each region is named and summarized, with its recent notes" },
    ],
  },
  {
    id: "people",
    tab: "People",
    title: "A private memory for people",
    body: "Profiles, organizations, relationships, facts, and logged conversations. The reconnect queue shows who you have not talked to in a while.",
    image: "people",
    alt: "The People list with roles, contexts, and the date of last contact for each person",
    callouts: [
      { x: 58, y: 4.8, text: "Save a detail about someone in one step" },
      { x: 14, y: 5.8, text: "A reconnect queue for people you have lost touch with" },
      { x: 56, y: 21, text: "Last contact comes from logged interactions" },
    ],
  },
];

export const MORE: [string, string][] = [
  ["Cleanup", "A daily card stack for revisiting old notes and archiving the done ones."],
  ["Events", "Shows and appointments with decisions, places, and calendar feeds."],
  ["Time blocks", "A week calendar for where the hours go."],
  ["Web archive", "A browser extension saves pages into searchable notes."],
];

export type Call = { tool: string; args: string; result: string };
export type Step = { kind: "user" | "agent"; text: string } | { kind: "calls"; calls: Call[] };

// Written against the demo database with the real tool names and arguments.
export const EXCHANGE: Step[] = [
  { kind: "user", text: "Put the follow-ups from my walk memo on Friday." },
  {
    kind: "calls",
    calls: [
      {
        tool: "search",
        args: '{ query: "walk memo research board" }',
        result: "1 note: Voice memo: walk thoughts on the research board",
      },
      { tool: "tasks_query", args: '{ noteId: "cmwoejwqz…" }', result: "3 open tasks" },
      {
        tool: "tasks_update",
        args: '{ updates: [{ id, dueDate: "2026-11-21" } ×3] }',
        result: "3 tasks updated",
      },
    ],
  },
  {
    kind: "agent",
    text: "Done. The three follow-ups are due Friday: prototype the compact board layout, wire card comments into the agent prompt, and write the changelog entry.",
  },
];

export const RULES: [string, string][] = [
  ["Every edit keeps a version.", "The note page can restore any earlier one."],
  ["Edits I want to review come as proposals.", "I accept or reject each one inline in the editor."],
  ["Deleting stays with me.", "Agents cancel, hide, or archive instead."],
  ["Every call is logged.", "The Activity page shows which client did what."],
];

export const POSTS = [
  {
    href: `${BYRON}/blog/voice-memos-to-searchable-notes`,
    title: "Voice memos that turn into searchable notes",
    date: "2026-11-02",
    note: "Transcripts with summaries, timed sections, and tasks, for about $0.04 an hour.",
  },
  {
    href: `${BYRON}/blog/things-i-consider-when-building-an-mcp-server`,
    title: "Things I consider when building an MCP server",
    date: "2026-11-19",
    note: "Fixable errors, one way to register tools, and reading the call log.",
  },
  {
    href: `${BYRON}/blog/cleaning-up-notes-with-decision-models`,
    title: "Cleaning up 6,300 notes",
    date: "2026-10-25",
    note: "From decision models to a review queue that works in production.",
  },
  {
    href: `${BYRON}/blog/moving-visual-notes-to-solidstart-2`,
    title: "Moving Visual Notes to SolidStart 2",
    date: "2026-10-26",
    note: "The build went from 292s to 49s. The breakage was at the boundaries.",
  },
];

export const STACK: [string, string][] = [
  ["App", "SolidStart, TypeScript"],
  ["Data", "PostgreSQL, Prisma"],
  ["Search", "Full text plus OpenAI embeddings"],
  ["Canvas", "UMAP"],
  ["Voice", "Groq Whisper"],
  ["Agents", "MCP over HTTP, with OAuth"],
];
