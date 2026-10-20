---
title: "Block-based note storage — shape brief"
slug: "block-storage"
phase: shape
status: current
last_updated: "2026-10-19"
---

# Block-based note storage: what we are adding

**Outcome:** Each note is stored once, as structured blocks with stable IDs. Links, tasks, cross-note views, and AI edits all work from that one format.

**Primary flow:** edit a note → autosave sends the block document → the server validates it, merges by block, and updates the block and link indexes in one transaction → backlinks, tasks, views, search, and ChatGPT see the change.

## Feature scope

```text
Note storage
├── PLANNED ADDITIONS
│   ├── One canonical format
│   │   ├── TipTap JSON per note, versioned; every block node carries a stable id
│   │   ├── One shared schema, used by the editor, server conversions, and migration
│   │   └── Derived block index (id, note, type, order, text, attrs) and link index
│   ├── Migration of existing notes
│   │   ├── One-time HTML/markdown → blocks conversion, with a dry-run loss report
│   │   └── Legacy html/markdown columns still written and readable until cutover is confirmed
│   ├── Links and backlinks
│   │   ├── [[ picker: notes, headings, blocks; the link shows the target's current title
│   │   ├── "Copy link to block"; /docs/:id#b-:blockId scrolls to and highlights the block
│   │   └── Backlinks panel on every note
│   ├── Safer concurrent edits
│   │   ├── Saves carry a base version; edits to different blocks merge
│   │   └── Same-block conflict: newer wins, the other is kept as a revision
│   ├── Inline tasks
│   │   ├── A checkbox creates a real TaskItem, rendered live in the note
│   │   └── Checking it off in the note or in Tasks updates both; Tasks links back to the note
│   ├── Fixed cross-note views
│   │   └── Backlinks · open tasks across notes · blocks with #tag
│   ├── ChatGPT / in-app AI
│   │   ├── Read: markdown with block IDs
│   │   └── Write: replace / insert-after / delete by block ID, plus append
│   └── Removal of bulk ingest
│       └── cli-ingest, POST /api/docs ingest, and source-filter UI that only served ingest
├── EVALUATE BEFORE COMMITTING
│   ├── Keeping a derived plain-text copy on Doc for search and embeddings (keep only if measurably faster)
│   └── Removing the inline-image migration admin tool (it is HTML-specific)
└── LATER POSSIBILITIES
    └── Time-block, archived-page, and data-table blocks · saved filters · dropping legacy columns
```

## Behavior

| Situation | Expected result |
| --- | --- |
| A note is renamed | Links to it show the new title; nothing in the linking notes is rewritten |
| A linked block is deleted | The link renders as "missing block" and falls back to opening the note; the backlink disappears |
| A block is cut and pasted into another note | It keeps its ID, and existing links follow it |
| A duplicate ID appears (copy-paste inside one note) | The copy gets a new ID on save; the original keeps its ID |
| A task block is deleted from a note | The TaskItem stays in its list and loses its note link (no silent data loss) |
| ChatGPT edits block B while you are typing in block A | Your next save merges both; the editor applies B without moving your cursor |
| ChatGPT and you edit the same block | The newer edit wins, and the other version appears in revision history |
| A migrated note has unknown HTML | Its content is simplified to the nearest block type; the original HTML stays in a revision |

## Examples

Proposed ChatGPT read format (syntax not settled):

```markdown
## Launch plan ^b-7Kq2
- [ ] Draft pricing page ^b-x91a {task:ck8...}
See [[Pricing research]] and [[Q3 goals#Hiring]]. ^b-Lm30
```

Proposed edit call: `edit_note { noteId, ops: [{ op: "replace", blockId: "b-Lm30", markdown: "…" }] }`.

## Decisions and boundaries

**Appetite:** One night, delivered as stacked PRs. Each PR leaves the app shippable. Removing ingest goes first because it shrinks what the migration has to keep working. Dropping the legacy columns is a later PR, after a soak period.

**Key decision: canonical JSON document plus derived block rows, not one database row per block.** The editor already produces a whole document. Nested lists and tables stay valid as a unit. Revisions stay simple snapshots. Each save is one transaction. The block and link tables still give IDs, backlinks, queries, and per-block merge, because the block ID is the join key. Making rows canonical would mean reassembling every document on read and keeping parent/order invariants correct by hand, without making any of the four features easier.

**Key decision: a shared schema replaces `sanitize-html` as the content gate.** The server validates against the same TipTap schema the editor uses, so new block types survive saves and unknown markup is dropped by structure, not by an attribute allowlist. Editor-only Solid NodeViews stay on the client. The schema module must import nothing from the UI.

**Collision:** The ChatGPT connector depends on `originalSource`/`originalContentId` for idempotent creates. Those columns stay when ingest is removed.

**Boundary:** No transclusion, CRDT, presence, or query language. Rollback during the transition is a read switch back to the legacy columns, which stay dual-written until cutover is confirmed.

**First proof:**
- **Try:** shared schema, content column, and migration run against a local copy of the real notes; add `[[` links and backlinks.
- **Observe:**
  - the migration report: notes converted, and how many lose more than 2% of their text;
  - block IDs unchanged across three edit/save/reload cycles and a cross-note paste;
  - a backlink appears within one save.
- **Decide:** If IDs churn, or more than a few notes lose meaningful content, fix the schema and ID strategy before stacking tasks, merging, or MCP on top.

**Open choices:** Which list new inline tasks go into: one Inbox list (default), or a list per note path.

Intent: [intent-brief.md](intent-brief.md)
