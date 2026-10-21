---
title: "Research threads — shape brief"
slug: "research-threads"
phase: shape
status: current
last_updated: "2026-10-19"
---

# Research threads: what we're adding

**Outcome:** An agent explores a topic and posts its findings, and you see them as one canvas. The canvas shows where each item came from, folds into summaries at every zoom level, and keeps the open frontier in view.

**Primary flow:** Create a topic → an agent calls `ingest_tree` over MCP → the topic canvas lays out the tree → you zoom out to summaries, dive in to details, and send the next open question to an agent.

## Feature scope

```text
Research threads
├── PLANNED ADDITIONS (first proof)
│   ├── Topics: each is its own canvas
│   │   ├── Topic index: title, top summary, open count, last activity
│   │   └── Create, rename, archive a topic
│   ├── Cards: task, question, finding, source, summary, option, criterion
│   │   ├── Title + short body; a card can open into a full rich note
│   │   ├── Open/done/dropped state (task, question); sources hold URL, snippet, image
│   │   └── Came-from parent (one) + relates-to links (any)
│   ├── Agent writes over MCP (token-authenticated)
│   │   ├── ingest_tree: one nested payload → many cards in one batch
│   │   ├── add_card, link_cards, set_state, read_topic, list_frontier
│   │   └── Every write is recorded as a batch with agent + time; undo a batch
│   └── Topic canvas
│       ├── Auto layout from came-from structure; drag to nudge, position remembered
│       ├── Summary groups: a summary card covering any set of cards, even across branches
│       ├── Semantic zoom: zoom out → accepted groups fold into their summary card
│       ├── Open tasks/questions stay visible even inside folded groups
│       └── Done/dropped branches fade; nothing auto-deletes
├── NEXT (right after the proof works)
│   ├── In-app summary drafting: "summarize this group" → draft → accept/edit
│   ├── Manual card capture and linking on the canvas
│   └── Report/notes ingest: paste a report or outline → split into a draft tree
└── LATER POSSIBILITIES
    ├── Decision view: options × criteria
    ├── Collapse open items into counts if the frontier gets cluttered
    └── Cross-topic links, library meta-canvas
```

## Behavior

| Situation | Expected result |
| --- | --- |
| Agent ingests a tree under an existing question | New cards attach under that question; the batch appears in the topic's history |
| Ingest payload is malformed or references an unknown card | Whole batch rejected with a readable error; nothing partially written |
| Same payload retried with the same batch key | No duplicates; returns the original result |
| Ingest includes a summary group | Lands as a **draft** summary; folds only after you accept it |
| You undo an agent batch | Its cards and links disappear; your later edits to other cards stay |
| Zoom below the fold threshold | Accepted groups show their summary card only, plus open items and the pedigree lines leading to them |

## Examples

Draft ingest payload (shape of the call, not final syntax):

```json
{
  "topic": "learn-rust-async",
  "under": "q_why_pin",
  "batchKey": "claude-2026-10-19-a",
  "agent": "claude-code",
  "cards": [
    { "type": "finding", "title": "Pin prevents moving self-referential futures",
      "body": "…", "children": [
        { "type": "source", "title": "Rust async book §4", "url": "https://…" },
        { "type": "question", "title": "When does Unpin get auto-implemented?" }
    ]}
  ],
  "summaries": [
    { "title": "Pinning basics", "covers": ["$0", "$0.0"], "body": "…" }
  ]
}
```

## Decisions and boundaries

**Appetite:** One shippable vertical slice, consisting of the topic model, MCP ingest, and a read-mostly canvas, before any manual-editing polish or in-app AI.

**Key decision:** `ingest_tree` is the core write operation, and MCP is a thin adapter over it. The same validated JSON payload can also be posted from a fixture file in tests and local seeding. So the canvas, the data model, and undo can all be built and checked without an agent or MCP client in the loop.

**Key decision:** The first proof lets ingest carry the agent's own summary drafts. You still accept each one, so fold-by-summary can be tested before in-app drafting exists.

**Key decision:** Research tools ride on the app's existing MCP connector, which handles OAuth and the dev token. So Claude Code runs the first proof locally, and ChatGPT gets the same tools once the connector is deployed.

**Boundary:** This is a clean model. It leaves existing Tasks, Explorer, Docs, and `/canvas` untouched, with no migration. The feature lives at its own routes, so disabling it means hiding the nav entry and revoking the token. The app never generates frontier items itself.

**First proof:** **Try:** Run a real learning topic. Have Claude Code explore it through two or three rounds of `ingest_tree`, about 40–80 cards with some summary drafts. **Observe:** Does the zoomed-out view read as summaries plus a clear frontier? Can you find where any finding came from within two clicks? Do the open items that stay visible inside folds clutter the view? **Decide:** If the zoomed-out view is readable and you'd hand it the next question, add in-app summaries and manual capture. If open items clutter it, change the fold rule before adding anything else. If the tree layout fights the summary groups, rethink layout before building more on top of it.

**Open choices:** Should a card's full-note body be a regular `Doc`, so it shows up in search and embeddings, or private to the topic?

Intent: [intent-brief.md](intent-brief.md)
