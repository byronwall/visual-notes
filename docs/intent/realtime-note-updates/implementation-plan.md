---
title: "Realtime note updates — implementation plan"
slug: "realtime-note-updates"
phase: plan
status: current
last_updated: "2026-10-19"
---

# Realtime note updates — implementation plan

## Plan at a glance

The work runs in three steps.

1. Prove that the lists update live from any write. That step covers the reported bug end to end.
2. Make the open note safe, which carries the only real data-loss risk.
3. Confirm that WebSockets survive the production proxy.

Most of the plumbing already exists. `src/ws/jobs.ts`, `src/server/job-events.ts` (an in-process `BroadcastChannel`), and `src/lib/job-socket-client.ts` (reconnect with backoff) form a full pattern that no browser code uses yet. We copy that pattern for notes instead of inventing a new one.

The main pushback is on where publishing happens. It goes in one place, a Prisma query hook on `Doc` writes, instead of in each of the roughly ten write sites. That way MCP, the CLI ingest API, bulk actions, and future paths all publish without anyone remembering to. Events carry ids and `updatedAt` only. Clients re-run their existing queries, so nothing merges note content on the client.

Each milestone leaves the app working. Before milestone 1 lands, tabs behave as they do today. After it, lists are live. After milestone 2, open notes are live too.

## Implementation strategy

- **First proof:** the notes index is open in the browser, and an MCP Inspector `create_note` makes the note appear with no reload.
- **Primary seam:** `publishNoteChanges(changes)` and `subscribeNoteChanges()` in `src/server/note-events.ts`, with the same shape as `job-events.ts`. On the client, one `NoteLiveSync` provider mounted in the app shell.
- **Fast local loop:** `cd app && pnpm vitest run src/server/note-events src/lib/note-live` plus `pnpm dev` with two browser tabs. Run `scripts/mcp-smoke.ts` or the Inspector against the local audit database (see [audit-harness.md](../../../app/docs/audit-harness.md)).
- **Local dependencies:** none new. Postgres is the existing dev or audit-harness database.
- **Provider/live confirmation:** a deployed check that a ChatGPT write reaches an open production tab.
- **Rollout and rollback:** `VITE_NOTE_LIVE_SYNC` (default on). When it's off, the provider never connects, and the server endpoint stays idle.

## Milestone 1: New and changed notes appear in open lists

This milestone fixes the reported bug for every write source. It leaves the open editor alone.

- **Change — note event bus**
  - Add `src/server/note-events.ts`, a copy of the `job-events.ts` pattern on channel `notes-updates`. Its payload is `{ type: "notes:changed", changes: { id, updatedAt, deleted? }[] | null, at }`, where `null` means a bulk change with unknown ids.
  - Extend `src/server/db.ts` with `prisma.$extends({ query: { doc: { create, update, upsert, delete, createMany, updateMany, deleteMany } } })`. After each write succeeds, publish ids and `updatedAt` from the result; the `*Many` operations publish `null`. Publish only after a `$transaction` commits, which needs checking for interactive transactions.
  - Vitest: a fake listener receives the expected changes for create, update, and `updateMany`. A thrown write publishes nothing.
- **Change — authenticated `/ws/notes` router**
  - Add `src/ws/notes.ts` and a second `.addRouter` in `app.config.ts`. In `open`, call `isRequestAuthenticated(peer.request)` and close with code 4401 when it fails. Fan out to peers as `jobs.ts` does. Send a heartbeat ping so idle proxies don't drop the connection.
  - Verify with a manual `websocat` test with and without the cookie.
- **Change — client `NoteLiveSync` provider**
  - Generalize `job-socket-client.ts` into a small `createSocketClient` that both sockets can use. Mount `NoteLiveSync` in the app shell, client-only because it uses the WebSocket API; add a code comment saying so.
  - On each event, debounce for 250 ms, then call `revalidate([...NOTE_LIST_QUERY_KEYS])`. The keys are `docs-list`, `docs-index-list`, `docs-index-search`, `docs-paths`, `docs-path-stats`, `docs-path-page-data`, `docs-path-discovery`, `docs-related-notes-by-path`, and `docs-preview-*`.
  - On reconnect or `visibilitychange` to visible, run the same revalidate once.
  - Use logs prefixed `[note-live]`.
- **Spike — WebSocket router auth and upgrade under vinxi** (first hour)
  - Decision required: does `peer.request` carry cookies, and does the second WebSocket router coexist with `/ws/jobs`?
  - Evidence to gather: a local browser connection with logged auth results.
  - Fallback: an SSE route at `/api/notes/events` behind the same client provider, using the same bus.

### Desired end state

- With the notes index, a path page, and the sidebar recent list open, an Inspector `create_note` or `append_to_note` updates all three within about a second.
- A bulk delete from the index refreshes other tabs once.
- A connection without a cookie is refused. Unit tests cover publishing from the Prisma hook.

## Milestone 2: The open note refreshes safely

This is the data-loss risk, so it gets its own milestone and tests.

- **Change — expose refetch from the note resources**
  - `routes/docs/[id].tsx`, `DocumentEditor.tsx`, and `DocumentSidePanel.tsx` use `createResource`, which `revalidate` doesn't touch. Each one registers `{ docId, lastKnownUpdatedAt, isBusy(), refetch, onConflict }` with `NoteLiveSync` and unregisters on cleanup.
- **Change — decision rule (pure function, unit-tested)**
  - Event `updatedAt` ≤ last known → ignore. This covers the tab's own save.
  - Save in flight → queue the event, re-check after the save resolves, and compare against the returned `updatedAt`.
  - Clean → refetch, then reset the editor content. Dirty → show a notice.
  - Deleted → notice: "This note was deleted elsewhere."
- **Change — "Changed elsewhere" notice**
  - A small inline bar near the save status, built from existing `~/components/ui` pieces, with **Reload** and **Keep mine** actions. Keep mine means the next save overwrites the note; the revision history already preserves the ChatGPT version.

### Desired end state

- On a clean open note, ChatGPT's append appears in the editor.
- With unsaved typing, the text stays and the notice appears.
- Saving in tab A never resets the cursor in tab A.
- Vitest covers every branch of the decision rule. A Playwright smoke run uses two contexts against the audit database.

## Milestone 3: Proven in production

- **Change — deployed check**
  - Confirm the reverse proxy forwards `Upgrade` for `/ws/notes`. Confirm heartbeat timing against the proxy's idle timeout.
  - Run one live ChatGPT `create_note` with an open production tab.
- **Fallback:** if the proxy can't carry WebSockets, switch the provider to the SSE transport from the milestone 1 spike. Refetch on focus remains the floor.

### Desired end state

- A ChatGPT write shows up in an open production tab without a refresh.
- Flipping `VITE_NOTE_LIVE_SYNC` off returns tabs to today's behavior.

## Open decisions and spikes

- **WebSocket router auth and upgrade** (milestone 1 spike) — output: keep WebSocket or switch to SSE. Fallback: SSE.
- **Publishing inside interactive `$transaction` blocks** — output: publish on commit, or move publishing to explicit service calls for those sites. Fallback: explicit `publishNoteChanges` after the transaction.

## Below the cut line

- Canvas and UMAP live updates (canvas uses its own `createResource`; add it later through the same registration).
- Multi-instance fan-out via Postgres `LISTEN/NOTIFY`.
- Sending note content or diffs over the socket, and merging concurrent edits.
- Presence, "edited by ChatGPT" toasts, and live jobs UI on the existing jobs socket.
