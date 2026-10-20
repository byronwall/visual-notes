---
title: "Block-based note storage"
slug: "block-storage"
phase: intent
status: current
last_updated: "2026-10-19"
---

# Block-based note storage

## My read

Notes are stored as two strings, `html` and `markdown`, and neither one can be trusted. The editor saves sanitized HTML. The markdown column goes stale after the first save. ChatGPT reads through Turndown and writes through `marked`. Search, previews, embeddings, and revisions each guess which column is current. Nothing inside a note has an identity, so you can't link to it, query it, or edit it precisely.

You want one structured, block-based source of truth that serves notes created and edited inside the app, including AI and ChatGPT edits. It should make four things possible:

1. links to notes and to specific blocks, with backlinks;
2. typed objects inside notes, starting with real tasks;
3. fixed cross-note views;
4. AI edits that change one block without rewriting the whole note.

Bulk ingest is out of the picture for now and gets removed. Existing notes are converted once. Some loss on odd HTML is acceptable. The legacy columns stay only as long as it takes to be sure nothing broke.

You plan to build all of this tonight as a stack of PRs, so the order of the stack and safe intermediate states matter more than the total scope.

## What matters most

- **One canonical format.** Every reader and writer (editor, ChatGPT, in-app AI, search, embeddings, share page, revisions) derives from blocks. Nothing guesses between HTML and markdown.
- **Durable block identity.** A block keeps its ID across edits, saves, reloads, and moves between notes. Links and queries depend on it.
- **A top-quality in-app editing experience.** Autosave, revisions, and concurrent edits must feel at least as safe as they do today.
- **Room to grow.** New typed blocks and new link targets should be additive, not another migration.

## The experience you appear to want

You type `[[`, pick a note or a specific heading or paragraph, and get a link that keeps working after renames. The target note shows its backlinks. Typing a checkbox creates a real task that appears in Tasks; checking it off in either place updates both. A built-in view lists open tasks across notes, and another lists blocks with a given tag. ChatGPT reads a note as readable markdown with block IDs and edits individual blocks. If ChatGPT or another tab changes a different block while you type, both changes survive. If both touch the same block, the newer one wins and the other is kept as a revision.

## Boundaries

### Must be true

- Each block has a stable ID and belongs to exactly one note.
- Inline tasks are real `TaskItem`s.
- Conflicts are merged per block, with no live cursors.
- The ChatGPT connector keeps working through the migration.
- The `html` and `markdown` columns stay readable during the transition. After that, only a derived text form is kept, and only if embeddings or search need it for speed.

### Must be avoided

- Transclusion: the same block shown live in several notes.
- Real-time collaboration, CRDTs, or presence.
- A query language. Fixed views are enough for now.
- Continuing to maintain the bulk ingest path.
- Breaking existing notes, share links, or revisions during the cutover.

## What seems settled

- **First proof:** links and backlinks.
- **First typed object:** tasks only.
- **AI interchange:** markdown annotated with block IDs. AI edits target IDs.
- **Migration:** convert every note once, keeping the old HTML as a backup.
- **Ingest:** remove `cli-ingest` and the ingest endpoint now.

## Possibilities, not decisions

- Time blocks, archived pages, and the data tables PRD as later typed blocks.
- Saved filters or query blocks after fixed views.
- A cached plain-text or markdown copy for embeddings, only if it measurably helps.

## Current reality that matters

- The editor is TipTap 3.7. Its MIT extensions now include stable block IDs (`unique-id`), markdown round-tripping (`markdown`), and server-side rendering (`static-renderer`, `html`). Most of the conversion work is available off the shelf.
- `sanitize-html` is the content gate today. It strips any attribute it doesn't recognize, which is part of why richer node types can't survive a save.
- The ChatGPT connector uses `originalSource`/`originalContentId` for idempotent writes. Removing ingest must keep those columns or move that behavior somewhere else.
- `DocSection` (headings into embedding chunks), `DocRevision` (html and markdown snapshots), search, and previews all read the legacy strings directly.

## Next step after confirmation

Shape: see [shape-brief.md](shape-brief.md).
