import { For } from "solid-js";

const GITHUB = "https://github.com/byronwall/visual-notes";
const BYRON = "https://byroni.us";
const shot = (name: string) => `${import.meta.env.BASE_URL}shots/${name}.webp`;

type Feature = {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  image: string;
  alt: string;
  /** Height of the 2x shot when it is cropped shorter than the usual 1800. */
  height?: number;
};

const FEATURES: Feature[] = [
  {
    id: "voice",
    kicker: "Voice memos",
    title: "Talk on a walk, get a note back",
    body: [
      "Record on a note, or drop memos in. The audio is transcribed, then a planning pass writes a summary, splits the transcript into titled sections, and pulls out tasks with the timestamp where you said them.",
      "The transcript stays on the note and stays searchable, so the raw words are there when the summary misses something.",
    ],
    image: "voice",
    alt: "A note with a recording, a short summary, three extracted tasks, and a transcript split into three titled sections",
  },
  {
    id: "write",
    kicker: "Writing",
    title: "A plain editor that saves as you type",
    body: [
      "The editor is borderless, with a slash menu, tables, code blocks, and checklists. Notes are filed by dot path, like work.canvas.perf, and tags work inline.",
      "Every block has an ID. That matters more than it sounds: an agent can change one paragraph without rewriting the whole note, and the note keeps a version you can restore.",
    ],
    image: "editor",
    alt: "A note filed under work.canvas.perf with a measurements table, a numbered plan, a code block, and task checkboxes",
  },
  {
    id: "tasks",
    kicker: "Tasks",
    title: "Tasks stay where you wrote them",
    body: [
      "A checkbox in a note is a real task. Every one of them collects into one inbox, with lists and due days, and each task links back to the note it came from.",
      "So the meeting note keeps its context, and the inbox still tells you what to do next.",
    ],
    image: "tasks",
    alt: "The task inbox with 54 open tasks, each linked back to the note that holds it",
  },
  {
    id: "collections",
    kicker: "Collections",
    title: "Tables where every row is a note",
    body: [
      "Collections have typed properties: dates, places, prices, decisions. Show one as a table, board, gallery, or calendar, and embed a live view inside any note.",
      "Each row is still a full note, so the details you collect about a show or a restaurant live in the row itself.",
    ],
    image: "collection",
    height: 1000,
    alt: "A Date Nights collection shown as a table with category, price, next show, place, and decision columns",
  },
  {
    id: "research",
    kicker: "Research and pathways",
    title: "Research opens as a map",
    body: [
      "A research topic holds criteria, options, questions, tasks, notes, and sources, and opens as a mind map you can expand. A comment on a card is addressed to the agent, so the next research run picks it up as an instruction.",
      "Pathways do the same for decisions: a map with lanes and voting, for the choices that take more than one sitting.",
    ],
    image: "research",
    alt: "A research topic on learning async Rust, expanded into options, questions with answers, tasks, notes, and sources",
  },
  {
    id: "canvas",
    kicker: "Canvas",
    title: "See what you have been writing about",
    body: [
      "Embeddings and UMAP place every note by similarity, and the canvas names the regions it finds. It is the view that gave the app its name.",
      "Search uses full text and embeddings together, so you can find a note by the words in it or by what it was about.",
    ],
    image: "canvas",
    alt: "The canvas with six labeled regions of notes and a side panel that summarizes each region",
  },
  {
    id: "people",
    kicker: "People",
    title: "A private memory for people",
    body: [
      "Profiles, organizations, relationships, facts, and logged conversations. A reconnect queue shows who you have not talked to in a while.",
    ],
    image: "people",
    alt: "The People list with roles, contexts, and the date of last contact for each person",
  },
];

const MORE = [
  ["Cleanup", "A daily card stack for revisiting old notes and archiving the ones that are done."],
  ["Events", "Shows and appointments with decisions, places, and calendar feeds."],
  ["Time blocks", "A week calendar for planning where the hours go."],
  ["Web archive", "A browser extension saves pages, and the archive keeps them searchable."],
];

const TOOLS = [
  "search",
  "notes_get",
  "notes_edit_blocks",
  "notes_propose_edits",
  "tasks_query",
  "tasks_update",
  "collections_add_rows",
  "research_add_cards",
  "pathways_edit",
  "people_log_interaction",
  "events_create",
  "archive_query",
];

const STACK = [
  ["SolidStart", "app and server in TypeScript"],
  ["PostgreSQL + Prisma", "notes, blocks, revisions, and every other record"],
  ["OpenAI embeddings + UMAP", "search and the canvas layout"],
  ["Groq Whisper", "voice memo transcription"],
  ["MCP over HTTP", "the agent connector, with OAuth"],
];

function Logo() {
  return (
    <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="#f2ebdf" />
      <path
        d="M9 8.5h14a1.5 1.5 0 0 1 1.5 1.5v10.5L19 26H9a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 9 8.5Z"
        fill="#fff"
        stroke="#15171f"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path d="M19 26v-4a1.5 1.5 0 0 1 1.5-1.5h4" fill="none" stroke="#15171f" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M11.5 6.5v4M16 6.5v4M20.5 6.5v4M11 14h10M11 17.5h10" stroke="#15171f" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}

function Frame(props: { src: string; alt: string; eager?: boolean; full?: boolean; height?: number }) {
  return (
    <figure class="frame">
      <div class="frame-bar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <img
        src={props.src}
        alt={props.alt}
        width={props.full ? 2880 : 2368}
        height={props.height ?? 1800}
        loading={props.eager ? "eager" : "lazy"}
        decoding="async"
      />
    </figure>
  );
}

export function Landing() {
  return (
    <>
      <header class="nav">
        <a class="brand" href="#top">
          <Logo />
          Visual Notes
        </a>
        <nav aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#agents">Agents</a>
          <a href="#how">How it works</a>
          <a class="nav-gh" href={GITHUB}>
            GitHub
          </a>
        </nav>
      </header>

      <main id="top">
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">A notes app, and the place agents work with me</p>
            <h1>Notes, voice memos, tasks, and research in one place.</h1>
            <p class="lede">
              Visual Notes is the app I use every day. It started as a small markdown import with an embeddings
              canvas. Now it holds my notes, tasks, voice memos, research, and people, and agents read and edit
              all of it with me over MCP.
            </p>
            <div class="cta">
              <a class="button primary" href={GITHUB}>
                Source on GitHub
              </a>
              <a class="button" href="#features">
                See what it does
              </a>
            </div>
            <p class="fine">Every screenshot here uses a demo database with invented notes.</p>
          </div>
          <Frame
            src={shot("notes")}
            alt="The Visual Notes notes list, grouped by when each note was last updated, with paths and filters"
            eager
            full
          />
        </section>

        <ul class="strip" aria-label="What is in the app">
          <For each={FEATURES}>
            {(f) => (
              <li>
                <a href={`#${f.id}`}>{f.kicker}</a>
              </li>
            )}
          </For>
          <li>
            <a href="#agents">MCP</a>
          </li>
        </ul>

        <div id="features">
          <For each={FEATURES}>
            {(f, i) => (
              <section class="feature" classList={{ flip: i() % 2 === 1 }} id={f.id}>
                <div class="feature-copy">
                  <p class="kicker">{f.kicker}</p>
                  <h2>{f.title}</h2>
                  <For each={f.body}>{(p) => <p>{p}</p>}</For>
                </div>
                <Frame src={shot(f.image)} alt={f.alt} height={f.height} />
              </section>
            )}
          </For>
        </div>

        <section class="more" aria-labelledby="more-title">
          <h2 id="more-title">Also in the app</h2>
          <ul>
            <For each={MORE}>
              {([name, text]) => (
                <li>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </li>
              )}
            </For>
          </ul>
        </section>

        <section class="agents" id="agents">
          <div class="agents-copy">
            <p class="kicker">Agents</p>
            <h2>Agents work in the same notes</h2>
            <p>
              The app serves an MCP endpoint, so ChatGPT or Claude can do nearly everything I can do in the UI.
              There are more than 60 tools across notes, tasks, collections, research, pathways, people, events,
              the archive, and search.
            </p>
            <p>A few rules keep that safe enough to leave on:</p>
            <ul class="rules">
              <li>
                <strong>Every edit keeps a version.</strong> The note page can restore any earlier one.
              </li>
              <li>
                <strong>Edits I want to review come as proposals.</strong> I accept or reject each one inline in
                the editor.
              </li>
              <li>
                <strong>Deleting stays with me.</strong> Agents cancel, hide, or archive instead.
              </li>
              <li>
                <strong>Every call is logged.</strong> The Activity page shows which client did what.
              </li>
            </ul>
          </div>
          <div class="tools" aria-label="Some of the MCP tools">
            <div class="tools-head">
              <span>POST /mcp</span>
              <span>tools/list</span>
            </div>
            <ul>
              <For each={TOOLS}>{(t) => <li>{t}</li>}</For>
              <li class="tools-more">…and more than 50 others</li>
            </ul>
          </div>
        </section>

        <section class="how" id="how">
          <div>
            <p class="kicker">How it works</p>
            <h2>One app, one database, my own server</h2>
            <p>
              Notes are markdown stored as blocks with IDs. Tasks, collection rows, and events are notes or point
              back to one, so search and the agent connector reach all of them through the same records.
            </p>
            <p>
              It is a personal app, and there is no hosted version to sign up for. The source is public, and it
              moves fast: 766 commits on main in the last three months.
            </p>
            <a class="button primary" href={GITHUB}>
              Read the source
            </a>
          </div>
          <dl class="stack">
            <For each={STACK}>
              {([name, use]) => (
                <div>
                  <dt>{name}</dt>
                  <dd>{use}</dd>
                </div>
              )}
            </For>
          </dl>
        </section>
      </main>

      <footer class="footer">
        <span>
          Built by <a href={BYRON}>Byron Wall</a>.
        </span>
        <span>
          <a href={`${BYRON}/projects/visual-notes`}>Project notes</a> · <a href={GITHUB}>GitHub</a>
        </span>
      </footer>
    </>
  );
}
