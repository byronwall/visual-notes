# Research threads

A research topic is one canvas of cards: tasks, questions, findings, sources, options, and criteria. Each card has one **came-from** parent and optional **relates-to** links. **Summary groups** are a separate layer: a summary card covers any set of cards, even across branches. Planning history lives in `docs/intent/research-threads/`.

## Where things live

| Piece | Location |
| --- | --- |
| Data model | `ResearchTopic`, `ResearchCard`, `ResearchLink`, `ResearchSummaryGroup`, `ResearchBatch` in `prisma/schema.prisma` |
| Write seam | `services/research/research.ingest.ts`: `ingestTree` (one transaction, `batchKey` idempotency, summaries land as drafts), `setCardStates`, `undoBatch`, `redoBatch` |
| Payload rules | `research.payload.ts` (zod) and `research.plan.ts` (pure planner: refs, `$0.1` paths, every error at once) |
| Fold + layout | `components/research/layout/fold.ts` and `tree-layout.ts` (pure, unit tested) |
| UI | `/research` (topic index), `/research/:slug` (canvas; `?view=outline`, `?card=<id>`) |
| Agents | MCP `research_*` tools in `server/mcp/research-tools.ts`, and REST `POST /api/research/topics[/:topic/ingest]` with `Authorization: Bearer $RESEARCH_AGENT_TOKEN` |

## Behavior worth knowing

- Nothing is hard-deleted. Undoing a batch soft-hides its cards and links and reverts its state changes. Undo is refused while a later active batch builds on the one being undone.
- Only **accepted** summaries fold. The canvas zoom bands map to fold levels (Detail, Summaries, Overview), one nesting layer per band. Open tasks and questions stay visible inside folded groups. Done and dropped branches fade.
- Drag a card to nudge it. The offset from its computed position is saved, so it survives later structure changes.

## Local loop

```sh
cd app
pnpm test -- src/services/research src/components/research src/server/mcp/research-tools.test.ts
# DB-backed ingest tests (loopback synthetic DB only)
RESEARCH_TEST_DATABASE_URL=postgresql://…/visual_notes_audit_x pnpm test -- src/services/research
# Seed fixture topics through REST against a running app
pnpm research:seed --base http://127.0.0.1:<port> --token <RESEARCH_AGENT_TOKEN> tests/fixtures/research/learn-rust-async.json
```

The audit harness sets `RESEARCH_AGENT_TOKEN=audit-harness-research-token`. It also forwards `MCP_CONNECTOR_ENABLED` and `MCP_DEV_TOKEN` from the env file, so a local agent can connect to `/mcp`. The browser spec is `tests/e2e/research-canvas.spec.ts`; set `RESEARCH_SHOTS_DIR` to save a screenshot of each zoom level.
