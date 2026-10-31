# Research threads

A research topic is one board of cards: questions, findings, options, tasks, criteria, and sources. The card type is its **role**, which the app gives behavior. A topic can declare **kinds** (its own terms, such as Carrier or Printer model) mapped onto a role, with **fields** that become columns. Cards sit in **streams**: 1–10 parallel threads, one board column each. Each card has one **came-from** parent and optional typed **links** (`relates_to`, `answers`, `blocks`, `supports`). Planning history lives in `docs/intent/research-threads/` and `docs/intent/research-ux/`.

## Where things live

| Piece | Location |
| --- | --- |
| Data model | `ResearchTopic` (`answer`, `kinds`), `ResearchStream`, `ResearchCard` (`gist`, `kind`, `fields`, `streamId`), `ResearchLink` (`kind`), `ResearchComment`, `ResearchBatch` in `prisma/schema.prisma`. `ResearchSummaryGroup` and card nudges are legacy and unused by the UI |
| Write seam | `services/research/research.ingest.ts`: `ingestTree` (one transaction, `batchKey` idempotency, returns `warnings`), `setCardStates`, `undoBatch`, `redoBatch`; `research.edits.ts`: `editCards` (text, gist, kind, fields, stream, parent move), `removeCards`, `updateTopic`; `research.setup.ts`: `setupTopic` (streams, kinds, topic answer as one batch); `research.comments.ts` (not batches) |
| Payload rules | `research.payload.ts` (zod) and `research.plan.ts` (pure planner: refs, `$0.1` paths, kinds and streams, every error at once) |
| Streams, relations, lint | `research.streams.ts` (`assignStreams`: explicit stream, else came-from ancestor's, else Unsorted; topics with no streams get one column per root) and `lintTopic`; `research.relations.ts` (answers, results, blockers, citations from parents plus typed links). Pure and unit tested |
| Board model | `components/research/board/board-model.ts`: columns with fixed blocks (Criteria, Options, Questions, Tasks, Notes, Sources), cards in creation order, answers and results nested within a column, cited sources folded into their finding. Pure and unit tested |
| UI | `/research` (topic index), `/research/:slug`: Map (default, titles and counts only, `components/research/map/`), `?view=board`, `?view=table` (Options table, one per kind), `?view=outline`. `?card=<id>` or `?stream=<key>` opens the reader, which resizes, expands to full width, and steps through a stream. The reader edits and removes cards as batches by "you". Open pages refresh on `app:changed` research events |
| Activity | `research.activity.ts` logs `research.*` events for agent, API, and in-app writes |
| Agents | MCP `research_*` tools in `server/mcp/research-tools.ts` and `research-tools-edit.ts` ([mcp-connector.md](mcp-connector.md#research)), and REST `POST /api/research/topics[/:topic/ingest]`, `PATCH /api/research/topics/:topic` (setup) with `Authorization: Bearer $RESEARCH_AGENT_TOKEN` |

## Behavior worth knowing

- Nothing is hard-deleted. Undoing a batch soft-hides its cards, links, and streams and reverts its state changes, edits, and frame changes. Undo is refused while a later active batch builds on the one being undone.
- The layout owns positions; there is no dragging. A card moves only when cards above it in its own column change, and new cards land at the end of their block.
- A card nests under its holder (answer under question, result under task) only when both are in the same stream; otherwise the relation shows as a chip.
- Writes return `warnings` from `lintTopic` (cards in no stream, long titles, missing gists, fan-out over 8, criteria used as folders, sources that back nothing). They guide; they never reject. Unknown kinds and streams are errors.
- Comments are notes for the next agent pass. `research_get_topic` lists open ones and `research_resolve_comments` closes them.

## Local loop

```sh
cd app
pnpm test -- src/services/research src/components/research src/server/mcp/research-tools.test.ts
# DB-backed ingest tests (loopback synthetic DB only)
TEST_DATABASE_URL=postgresql://…/visual_notes_audit_x pnpm test .db.test
# Seed fixture topics through REST against a running app
pnpm research:seed --base http://127.0.0.1:<port> --token <RESEARCH_AGENT_TOKEN> tests/fixtures/research/learn-rust-async.json
# Restructured fixtures declare streams and kinds through `setup`
pnpm research:seed --base http://127.0.0.1:<port> --token <RESEARCH_AGENT_TOKEN> tests/fixtures/research/printer-streams.json
```

The audit harness sets `RESEARCH_AGENT_TOKEN=audit-harness-research-token`. It also forwards `MCP_CONNECTOR_ENABLED` and `MCP_DEV_TOKEN` from the launching shell or the env file, so a local agent can connect to `/mcp`. The browser specs are `tests/e2e/research-map.spec.ts`, `research-board.spec.ts`, and `research-editing.spec.ts`; set `RESEARCH_SHOTS_DIR` to save screenshots.
