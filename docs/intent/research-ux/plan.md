# Research topics rebuild: decisions and plan

Follows [audit.md](audit.md). Decisions come from Byron's answers on October 24, 2026.

## Goals

- **One structure has to work for deciding, exploring and reading.** Byron sifts, reads and digests. He rarely edits, and he asks an agent to fix anything that's off.
- **The overview shows streams and relationships.**
  - A topic has 1–10 parallel or disconnected streams.
  - At a glance you can see question → answers, option ↔ blocker, and task → result.
- **Consistency over cleverness.** Things stay in the same places. New things appear in new places without moving old ones.
- **Long content stays on the card.** A card has a title, a short gist and a body, read in a wide reader. Nothing spills into extra notes.
- **Agents get guidance and warnings, not hard rejections.** The one exception is declared kinds: writing an undeclared kind is an error, so the vocabulary doesn't sprawl.

## Decisions

| Area | Decision |
| --- | --- |
| Positions | **The layout owns positions.** No dragging. Nudges are ignored, then dropped. |
| Overview | **Stream board:** one column per stream, ordered by stream `sortOrder`. New streams are added on the right. Each column has fixed blocks in a fixed order: Answer, Questions (answers nested under each), Options (blockers as chips, fields inline), Tasks (results nested), Notes, then Sources (count only). Cards keep their creation order inside a block; state never reorders them. Topic-wide criteria and the topic answer sit in a header band. Unresolved cards go to an **Unsorted** column at the far right. |
| Canvas engine | An HTML board (CSS grid columns, page scroll) replaces the SVG pan/zoom canvas, tidy-tree layout, fold levels, hulls and lanes. A Compact/Detailed density toggle replaces zoom levels. |
| Roles vs kinds | The `ResearchCardType` enum stays as the **role**, which the app gives behavior. A topic declares **kinds**: `{key, label, role, fields[]}`, at most 12. A card can carry `kind` (which must be declared) and `fields` (`{key: string}`). With no kind, the role is the label. |
| Streams | `ResearchStream {key, title, goal, answer, sortOrder}`, at most 10 per topic, declared by the agent. A card's stream is its explicit `streamId`, else its nearest came-from ancestor's stream, else **Unsorted**. Links never change which stream a card is in. Topics with no declared streams fall back to one column per root card, so old topics still render. |
| Relationships | Link `kind`: `relates_to` (default), `answers` (X answers question Q), `blocks` (question/task blocks option), `supports` (source backs finding). Came-from children also count: a finding under a question is an answer, a card under a task is a result, a source under a finding is a citation. |
| Sources | Not drawn as cards on the board. A finding shows a citation count, and its sources are listed in the reader. A source with nothing to support sits in the stream's Sources block. |
| Summaries | Drop draft/accept and hulls. Each stream has one `answer` (markdown, agent-maintained). The topic also has an `answer`. Old summary-group tables stay unused until the two live topics are migrated; legacy summary cards show as Notes. |
| Card text | `title` (aim for ≤80 characters; warn above that), `gist` (≤280 characters, shown on the board), `body` (long markdown, shown in the reader). |
| Reader | Two modes. A side panel with a drag-resize handle (double-click resets, the width is saved). An **Expand** button turns it into a full-width reader with prev/next through the stream. Tables get borders, padding and horizontal scroll. |
| Editing | In-app editing stays: title, gist, body, kind, stream, state. **Comments** (`ResearchComment`) can be left on a card or a stream. The agent sees open comments in `research_get_topic` and resolves them with `research_resolve_comments`. |
| MCP | `research_update_topic` takes `streams`, `kinds` and `answer`. Cards take `gist`, `kind`, `fields` and `stream`. Links take `kind`. Writes return `warnings[]`: long title, missing gist, more than 8 children under one parent, a root with no stream, a source attached to nothing, unsorted cards. Topic output is grouped by stream, includes open comments, and gives a card URL template. `summaries` is removed. |
| Existing data | Synthetic fixtures copy the *shape* of both prod topics: flat fans, a parking-lot criterion, orphan sources, essay bodies. The real content contains personal data, so it isn't copied into the repo. Once deployed, an agent restructures both live topics through the new MCP contract, which doubles as the end-to-end proof. |

## PR stack

1. **docs**: audit and this plan.
2. **reader**: resizable and expandable inspector, table styling (on the current page, so it ships alone).
3. **model**: Prisma migration (streams, comments, topic `kinds` and `answer`, card `gist`, `kind`, `fields` and `streamId`, link kinds), store, ingest, edit services, stream resolution plus lint (pure, tested).
4. **mcp**: payload and tool contract, warnings, stream-grouped formatting, comment tools, guidance text, tests.
5. **board**: the stream board view replaces the canvas; remove fold, hulls, lanes and nudge; update the Contents list to group by stream.
6. **comments + editing**: comment thread in the reader; edit form gets gist, kind and stream; reader prev/next.

Each UI PR gets before/after screenshots from a local audit-harness database seeded with the synthetic fixtures.

## Proof

- **Insurance-shaped fixture** (1 stream, 9 options, 6 blocking questions): every option shows its blocker chip, and no card sits outside its column.
- **3D-printer-shaped fixture** (5 streams, 31 sources): no source cards on the board, each finding shows a citation count, and the criterion is no longer a 31-way fan.
- **Append-stability:** adding a card to stream 2 changes no card positions in streams 1 or 3 (a geometry test on the board model).
- **Lint:** an orphan root with no stream comes back in `warnings`, and the board shows it in Unsorted.
