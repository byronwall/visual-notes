---
title: "Agent inbox — implementation plan"
slug: "agent-inbox"
phase: plan
status: draft
last_updated: "2026-11-08"
---

# Agent inbox — implementation plan

## Plan at a glance

You want one release, so the plan is one gh-stack with five layers, merged together. The layers are ordered by risk, not by subsystem.

Layer 1 proves the riskiest part before anything else depends on it: agent-proposed edits that show inline and that you accept in an open editor. If the editor and autosave cannot handle this cleanly, the fallback (an inbox diff with server-side accept) changes how layers 3 and 4 present proposals. Layer 1 must settle this first.

Layer 2 adds typed highlights and the annotation rail, for you only. Annotation anchoring is the second-hardest piece, and it needs no agents to test. Layer 3 connects agents: requests, claims, threads, and the MCP tools, all proven with a local fake agent script. Layer 4 adds the inbox page and badge, built on data that layers 1–3 already produce. Layer 5 is the live confirmation with a real scheduled ChatGPT task. That layer needs you.

Every layer works on its own behind the `AGENT_INBOX` switch. Each one passes the repo checks and adds its own Playwright check. The local loop never needs ChatGPT: a script that uses the official MCP client plays the agent.

## Implementation strategy

- **First proof:** A fake agent proposes a replace and an insert on a seeded note. You accept one suggestion in the open editor while you type in another block.
- **Primary seam:** The MCP tool layer (`server/mcp/tool-registry.ts`). Agents reach the feature only through five new tools, so the fake agent and ChatGPT use the same path.
- **Fast local loop:** `cd app && TEST_DATABASE_URL=… pnpm exec vitest run src/lib/annotations src/server/annotations`, plus `node --experimental-strip-types scripts/agent-inbox-smoke.ts` against the audit-harness server.
- **Local dependencies:** A per-worktree Postgres from `pnpm audit:db`. Seeded notes come from the smoke script. There are no external services.
- **Provider/live confirmation:** One scheduled ChatGPT task against prod, on one test note, done by you (layer 5).
- **Rollout and rollback:** With `AGENT_INBOX=off`, the server registers no inbox tools, the note page shows no rail or suggestions, and `/inbox` returns 404. The new tables stay in place. No existing table changes shape.

### Material dependency proof strategy

ChatGPT is the only external dependency. Its first-proof role is a **local substitute**: `scripts/agent-inbox-smoke.ts` is a copy of the `scripts/mcp-smoke.ts` pattern, with the official MCP client and `MCP_DEV_TOKEN`. It can pose as two agents to test claim races. The live rung is one scheduled-task run in layer 5. Its only job is to confirm that ChatGPT runs the tools unattended. It is not a test of app behavior.

## Milestone 1: An agent proposes edits, and you accept them inline

This layer proves editor-side accept. It deliberately excludes highlights, requests, and the inbox.

- **Change — Data model.** Add `Annotation` and `EditProposal` to `prisma/schema.prisma` through `prisma migrate dev`. `Annotation` holds the target (`docId` or `taskId`), an optional anchor (`blockId`, `quote`), `typeId`, `body`, `author` (`you` or the client name), and the request fields. The request fields are `status`, `claimedBy`, `claimedAt`, `readyAt`, `closedAt`, and `seenAt`. `EditProposal` holds `docId`, an optional `annotationId`, and `ops` as JSON. Each op is `{op, blockId, blocks (TipTap JSON), baseHash}` and has a state: `pending`, `accepted`, `rejected`, or `stale`. Add only the columns this layer uses. Layer 3 adds the request fields.
- **Change — `notes_propose_edits`** in a new `server/mcp/annotations-tools.ts`. It takes the same input as `notes_edit_blocks`. It converts markdown with `contentFromMarkdown` and stores inline images as `editNote` does. It records `baseHash` with `hashNode` from `lib/note-content/ids.ts` and works on any note. It logs `annotation.propose` and publishes the `docs` live change. db test: an unknown block id is refused with valid ids, as in `editNote`.
- **Change — Suggestion layer in the editor.** Add `components/editor/extensions/ProposalDecorations.ts`, a ProseMirror plugin that follows the `editor/images/imagePasteState.ts` DecorationSet pattern. A replace or delete draws a node decoration (struck through) on the target block. A replace or insert adds a widget with the new blocks rendered read-only, plus Accept and Reject buttons. An op whose `baseHash` no longer matches the live block shows "note changed" and has no Accept button.
- **Change — Accept as an editor transaction.** Write a pure function `proposalToTransaction(state, op)` that finds the block by id, replaces or inserts the nodes, and keeps the incoming block ids. `DocumentEditor` runs it, and autosave persists it. Then a server action marks the op `accepted`. Reject only calls the server action. The tests are Vitest on the pure function (replace, insert_after, delete, missing block, hash mismatch).

### Desired end state

- After the smoke script proposes edits, the open note shows them inline. Accept lands the blocks through the normal autosave, with a revision. A keystroke typed in another block during the accept is kept.
- A one-off Playwright check, written with the browser-check kit, covers the steps above at desktop and phone widths and saves screenshots.
- **Decision:** If accept loses keystrokes or fights the deferred-remote-content path, stop. Switch to server-side accept-all, with the editor reloading through `useLiveNoteResource`. Record the switch in the map before you start layer 2.

## Milestone 2: Typed highlights in a rail beside the note

This layer delivers your own annotations, which are useful before any agent connects. It excludes MCP.

- **Change — Annotation types.** Add an `AnnotationType` table (`name`, `color` token, `forAi`, `isDefault`, `builtIn`). Seed "Request" (for AI, the default for Note to AI), "From AI" (built-in, agent-written), and "Note" (the default for highlights). Add a small settings page in `/admin` or a section of it to manage types, with server actions.
- **Change — Anchoring.** Add `lib/annotations/anchor.ts` with a pure resolver that takes a block's text, the quote, and an offset hint. It returns `{from, to}` or `detached`. The editor plugin maps decorations through each transaction. On autosave, the client sends the mapped quote for every annotation it moved. When a block id disappears, the annotation becomes `detached`. Tests cover these cases: an edit in another block, an edit inside the quote, a deleted block, and a repeated phrase.
- **Change — Create flow and rail.** Select text, then use a small popover (the existing `~/components/ui` popover) to pick a type and write a comment. Add `components/annotations/AnnotationRail.tsx` on the side opposite `TocRail`. Lay it out with the `toc-rail-layout-playbook` and fixed-position rules. Entries follow note order, and detached entries go on top. Clicking an entry scrolls to its highlight and back. At phone widths, the rail becomes a sheet behind a count button in `DocHeaderBar`.

### Desired end state

- You create, retype, edit, and delete highlights. The highlights survive a reload, an edit elsewhere, and a remote change from another tab.
- The note's `content`, `searchText`, and revisions do not change when you add a highlight. A db test asserts this.
- Playwright: create a highlight, edit elsewhere, reload. Rail screenshots at 1280, 783, and 390 px.

## Milestone 3: Agents receive and answer requests

This layer closes the loop with agents. It introduces the request lifecycle and four tools.

- **Change — Requests.** Add the request columns, an `AnnotationMessage` thread table, and a "Note to AI" button in `DocHeaderBar`. The button creates a whole-note annotation of the "Request" type. Add the same button and thread to `TaskSheet` for tasks. Any annotation with a `forAi` type is a request. Your reply on a `ready` request sets it back to `open`.
- **Change — MCP tools in `annotations-tools.ts`.**
  - `inbox_get` returns open requests with the note title, the passage, the thread, and nearby annotations of every type. It also returns open `ResearchComment` rows. It takes `since` and returns a `pollSince` cursor, like `activity_query`.
  - `inbox_claim` uses a conditional update: `status = open`, or a claim older than 24 h. A loser gets a refusal that names the agent that claimed it.
  - `inbox_reply` posts to the thread and can mark the request `ready`. Only you close a request.
  - `notes_annotate` uses the "From AI" type.
  - `notes_propose_edits` gains an optional `requestId`.
  - Tool descriptions and a new server-instructions line in `tools.ts` say: annotate or propose edits only when asked.
- **Change — Fake agent.** `scripts/agent-inbox-smoke.ts` seeds a note with a request and a highlight. It runs agent A and agent B. A claims, and B is refused. A annotates, proposes an edit, and replies "ready". The script prints the appUrls.

### Desired end state

- The smoke script passes against the audit-harness server. db tests cover the claim race, claim expiry, the reply that reopens a request, and the refusal for a closed request.
- In the note, the request thread shows agent replies, and its status changes live.

## Milestone 4: One inbox shows what waits on you

- **Change — `/inbox` route** with components in `components/inbox/`.
  - **Needs you:** ready requests, unseen agent replies and annotations, pending proposals, and research comments that an agent resolved since your last visit.
  - **Waiting on agents:** open and claimed requests.
  - **Agent activity:** `mcp.call` ActionEvents grouped by `agent` and an idle gap, one line per run, which expands to the existing `McpActivityPanel` rows.
  - Each item links to `/docs/<id>#<blockId>` or to the task. Opening or dismissing an item sets `seenAt`.
- **Change — Badge.** Add an Inbox entry to `nav-items.ts` with a "Needs you" count. Add a new `inbox` area to `APP_LIVE_QUERY_KEYS`, published by every annotation write, so the count updates without a reload.

### Desired end state

- After the smoke script runs, the badge updates live, the item opens the passage, and closing the request clears it.
- A Playwright check covers route render, item click, dismiss, and badge count, with screenshots for the PR.

## Milestone 5: A real agent works the inbox unattended

- **Change — Documentation.** Add the five tools to `docs/mcp-connector.md` and `docs/mcp-parity.md`. Add the `AGENT_INBOX` switch and the claim expiry to the docs.
- **Change — Live confirmation (you).** Deploy with `AGENT_INBOX=on`. Create one test note with one request. Set up a ChatGPT scheduled task that says "check my Visual Notes inbox and handle open requests". Watch the MCP tab for `inbox_get`, `inbox_claim`, and `inbox_reply` with a ChatGPT client name.

### Desired end state

- One unattended run claims and answers a request in prod, or the record shows what blocked it (plan tier, write approval), and the next step is clear.

## Open decisions and spikes

- **Agent annotation type:** "From AI" only, or agents pick your types? The default is "From AI", and agents get one optional `typeId` argument later if you want it. This does not block any layer.
- **Spike (layer 5): ChatGPT unattended writes.** Decide whether scheduled tasks can run write tools on a custom connector without approval. Look for evidence in the first live run and in OpenAI help-center docs. If they cannot, use Claude scheduled routines or another MCP client, because the tools do not depend on ChatGPT.

## Below the cut line

- Requests on research cards and archived pages. Merging `ResearchComment` into `Annotation`.
- Push, email, or digest signals. Standing agent instructions.
- Annotations inside code blocks or table cells. A proposal on those blocks shows as a plain before/after card.
- Proposals that span several notes. A history of proposals after they are resolved.
