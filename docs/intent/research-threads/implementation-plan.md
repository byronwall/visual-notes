---
title: "Research threads — implementation plan"
slug: "research-threads"
phase: plan
status: executed
last_updated: "2026-10-19"
---

# Research threads: implementation plan

## Status

All three milestones shipped as a PR stack (#108 → #111 → #115), and the first proof passed. Claude Code wrote 49 cards in three rounds over MCP, and the canvas opens on readable summaries plus the open frontier. Two changes from the plan:

- **MCP reuses the existing connector.** `main` gained an MCP server with OAuth 2.1 during this work, so M3 registers `research_*` tools on `/mcp` (`notes:read` / `notes:write`) instead of adding `/api/mcp`. As a result, ChatGPT access is available now rather than below the cut line. `RESEARCH_AGENT_TOKEN` guards only the REST ingest routes.
- **The layout spike chose a hand-rolled tidy tree.** It adds no new dependency and reserves room for hull labels.

The proof also drove three fixes: folding takes a card's descendants along, fit picks the shallowest readable level, and history names agent state changes. Next slice: in-app summary drafting and manual capture.

## Plan at a glance

The order is: **data model and ingest first, then the canvas, then MCP**. A real agent comes in only after the app can already show what an agent would write.

1. **Model + `ingest_tree` + outline view.** A fixture JSON tree runs through the real ingest service and shows up in a plain topic outline. That proves the data model, idempotency, and batch undo without a canvas or an MCP client.
2. **Topic canvas with semantic zoom.** The same fixture renders as an auto-laid-out canvas that folds into accepted summaries as you zoom out. This is where the readability question gets answered on fixture data.
3. **MCP adapter + live Claude Code run.** A thin MCP route wraps the same service, and a real exploration session runs the first proof.

The main pushback is to build MCP last, not first, even though "MCP ingest → canvas" is the proof. MCP is a transport. Everything that makes the proof succeed or fail lives behind it: the payload shape, refs, idempotency, undo, layout, and fold rules. Fixtures exercise all of it in seconds. Each milestone adds one new unknown: first the data model, then layout and zoom, then the MCP protocol and auth.

## Implementation strategy

- **First proof:** A Claude Code session explores a real learning topic through 2–3 `ingest_tree` calls. You judge the zoomed-out canvas.
- **Primary seam:** `ingestTree(topicId, payload)` in `services/research/research.ingest.ts`. It takes a zod-validated payload and runs one transaction. MCP tools, fixture seeding, and tests all call it.
- **Fast local loop:** `cd app && pnpm vitest run src/services/research src/components/research`. These are pure planners and fold/layout functions; Prisma is mocked the way `docs.queries.test.ts` does it.
- **Local dependencies:** Fixture topics in `app/tests/fixtures/research/*.json`. A seed script posts them through `ingestTree`. The DB and browser proof run against an audit-harness database, and none is provisioned in this worktree today (no `.env`, Postgres not running). Milestone 1 can be fully verified by unit tests; the browser proof needs the coordinator to provision a DB first.
- **Provider/live confirmation:** One manual Claude Code session against the local dev server over HTTP with a bearer token.
- **Rollout and rollback:** New tables and the `/research` routes only. Nothing existing changes. To disable: remove the nav entry and unset `RESEARCH_MCP_TOKEN`; the MCP route returns 401 when the token is unset.

### Material dependency proof strategy

MCP is the only external dependency. In milestones 1–2 it is **absent**: fixtures stand in for agent payloads. Milestone 3 adds an in-process contract test (SDK client ↔ server over the SDK's in-memory transport, with the service faked). Then it adds one live run with Claude Code. ChatGPT, which needs public HTTPS and OAuth, is below the cut line.

```text
ingestTree + fixtures (no MCP)
    → MCP server ↔ SDK client, in-memory contract tests
    → Claude Code over local HTTP + bearer (live smoke = first proof)
    → [below cut] deployed HTTPS + OAuth for ChatGPT
```

## Milestone 1: A fixture tree ingests into a topic and reads back as an outline

This proves the model and write semantics before anything visual. It deliberately leaves out the canvas, MCP, and in-app AI.

- **Change: Prisma models (via `prisma migrate dev --name research_threads`)**
  - `ResearchTopic` (title, slug, archivedAt).
  - `ResearchCard` (topicId; type enum: task, question, finding, source, summary, option, criterion; title; body markdown; state enum: open, done, dropped, used only for task and question; url, snippet, imageUrl; parentId for the single came-from parent; nudgeX/nudgeY, nullable; batchId; hiddenAt).
  - `ResearchLink` (from, to, kind `relates_to`, batchId).
  - `ResearchSummaryGroup` (summaryCardId, status draft|accepted, members join table).
  - `ResearchBatch` (topicId, batchKey unique per topic, agent, cardCount, createdAt, undoneAt).
- **Change: `research.ingest.ts`: payload schema + pure planner + transactional apply**
  - Payload fields: `under` (an existing card id), nested `cards` with optional `ref`, `links` and `summaries` that point at refs or existing ids, `batchKey`, and `agent`.
  - `planIngest(payload, existingIds)` returns a flat list of create operations or a list of readable errors. It's a pure function, so the unit tests cover unknown refs, cycles, invalid types, and a state set on a non-task card.
  - `applyIngest` runs the plan in a single `prisma.$transaction`. If the `batchKey` already exists, it returns the stored result.
  - Summaries in a payload always land as `draft`.
- **Change: batch undo**
  - Undo sets `undoneAt` on the batch and `hiddenAt` on its cards and links. It's a soft delete, consistent with "never delete", so redo is just clearing those fields.
  - Undo is refused when cards from a later batch that's still active depend on this one; the refusal names those batches.
  - Unit test for the dependency check.
- **Change: fixtures + seed**
  - Write `learn-rust-async.json` (about 60 cards, three summary groups, one dropped branch, one decision with options and criteria) and a small fixture for edge cases.
  - Add `pnpm research:seed <file>`, which goes through `ingestTree`.
- **Change: `/research` topic index and `/research/[slug]` outline**
  - The index shows title, the top accepted summary, the open count, and last activity.
  - The outline is a read-only came-from tree with type, state, and batch badges, plus an "Undo batch" action on the topic's batch list.
  - Queries use `query()` + `createResource`; writes are server actions. A nav entry goes in `nav-items.ts`.

### Desired end state

- Seeding the fixture produces a browsable topic outline. Re-seeding the same file creates no duplicates.
- Undoing a batch hides exactly its cards and links, and undoing the undo restores them.
- `pnpm lint && pnpm type-check && pnpm test` pass, with planner, idempotency, and undo tests. Outline route render is proven once an audit DB is available.

## Milestone 2: The topic canvas folds into summaries as you zoom out

This answers the shape's main readability question on fixture data, before any agent is involved. It also adds accepting summaries, since folding depends on it.

- **Change: pure layout: `layoutTopic(cards, groups)` in `components/research/layout/`**
  - A left-to-right tidy tree over came-from, with members of the same summary group packed next to each other where the tree allows. Saved nudges are applied on top.
  - Tests check for deterministic positions and no overlaps on the fixture.
- **Spike: layout engine**
  - Decision required: hand-rolled tidy tree vs `d3-hierarchy` vs `elkjs`.
  - Evidence: render the fixture with group hulls in each, and check whether cross-branch groups produce unreadable hulls.
  - Fallback: plain tidy tree, with cross-branch groups drawn as dashed connectors instead of hulls.
- **Change: pure fold: `foldView(cards, groups, zoom)`**
  - Above the threshold, everything shows. Below it, each accepted group collapses to its summary card. Open task and question cards stay visible, along with the pedigree edge back to the visible ancestor. Done and dropped cards fade.
  - Table-driven tests: folding, open cards piercing a fold, nested groups, and draft groups never folding.
- **Change: canvas route `/research/[slug]/canvas`**
  - Reuse the pan/zoom transform approach from `stores/canvas.store.ts`. Positions use inline `style`, per AGENTS.md.
  - Drag sets a nudge (server action). A card detail drawer renders the body markdown.
  - The canvas becomes the topic's default view, and the outline stays as a tab.
- **Change: summary review**
  - On a draft summary: accept, edit text, or discard. Only accepted groups fold.
- **Change: browser proof**
  - A Playwright smoke test plus `pnpm audit:shoot` captures the seeded fixture at three zoom levels and at 390 px. It checks hover, drag-nudge persistence, the drawer, and accepting a summary.

### Desired end state

- Zoomed out, the fixture reads as three summary cards plus its open questions. Zoomed in, every card shows.
- A nudged card stays put after reload.
- Fold and layout tests pass, and the screenshots are attached to the PR.

## Milestone 3: An agent writes into a topic over MCP and you run the first proof

This introduces the MCP protocol and token auth together. Nothing else in the milestone is new.

- **Spike: MCP transport inside Vinxi**
  - Decision required: does the SDK's web-standard Streamable HTTP transport, in stateless mode, mount as a SolidStart API route (`routes/api/mcp.ts`) on the pinned SDK version?
  - Evidence: `tools/list` from the SDK client, and from `claude mcp add --transport http`.
  - Fallback: a small stdio MCP CLI under `app/scripts/` that forwards to a REST `POST /api/research/ingest` endpoint, using the same service and token.
- **Change: MCP server + tools**
  - Tools: `list_topics`, `create_topic`, `read_topic` (summaries and frontier by default; `depth` for more), `list_frontier`, `ingest_tree`, `add_card`, `link_cards`, `set_state`.
  - Every write goes through `ingestTree`, or through a single-card helper that builds on it, so each one gets a batch.
  - Tool descriptions teach the payload with a short example.
- **Change: auth + middleware**
  - `RESEARCH_MCP_TOKEN` in the server env schema. The bearer check mirrors `server/lib/archive/auth.ts`, and the `/api/mcp` bypass in `middleware.ts` has a `middleware.test.ts` case.
  - Logs use the `[research-mcp]` prefix: tool name, topic, card count, duration, and errors.
- **Change: contract test**
  - The SDK `Client` talks to the server over the in-memory transport, with the service faked.
  - It asserts the tool list and schemas, maps a malformed payload to a tool error, and checks that a repeated `batchKey` is idempotent.
- **Change: first proof run**
  - Document the `claude mcp add` command and a short agent prompt in the research route's help.
  - Run a real learning topic through 2–3 `ingest_tree` rounds.

### Desired end state

- Claude Code lists the tools and grows a topic you can watch on the canvas, and you can undo one of its batches.
- The first-proof decision is recorded in the initiative map: readable, frontier clutter, or layout trouble. The decision picks the next slice.

## Open decisions and spikes

- **Card full-note body:** a regular `Doc` (searchable, embeddable) or topic-private markdown. Milestones 1–3 use topic-private `body`; switching later is a nullable `docId` plus a backfill. Decision needed before rich editing is built.
- **Layout engine** and the **MCP transport fit** are covered by the spikes above, each with a fallback.

## Below the cut line

- In-app summary drafting with `callLLM` (the first slice after the proof).
- Manual card capture and linking on the canvas, and rich-note editing.
- Report, notes, and web-capture ingest that splits a source into a draft tree.
- ChatGPT connector: public HTTPS, OAuth, and dynamic client registration.
- Decision view (options × criteria). Collapsing the frontier into counts. Cross-topic links. A library meta-canvas.
- Multi-user permissions, and any migration of Tasks or Explorer data.
