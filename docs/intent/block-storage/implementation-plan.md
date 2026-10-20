---
title: "Block-based note storage — implementation plan"
slug: "block-storage"
phase: plan
status: current
last_updated: "2026-10-19"
---

# Block-based note storage: implementation plan

## Plan at a glance

The work is a stack of nine PRs. Each one is a milestone that leaves `main` shippable. PRs 1–8 are tonight's work. PR 9 drops the legacy columns after a soak period.

The order follows risk.

- **Remove ingest first.** Every writer that is deleted is one fewer path the migration has to keep compatible.
- **Prove the format next.** PRs 2–3 show that block IDs survive real editing and that existing notes convert cleanly, using links and backlinks as the visible test. Nothing else builds on blocks until that holds.
- **Then switch the readers.** Search, previews, embeddings, the share page, and AI move to blocks while the legacy columns are still dual-written. A bad reader can be sent back to the old columns with one environment variable.
- **Then add the features that depend on a stable foundation:** per-block merge, then block-level MCP (which uses the merge), then inline tasks, then the fixed views.

Two choices differ from the obvious route.

- **Merge uses block hashes, not stored base snapshots.** The editor sends the hash of each top-level block as it last saw it. That gives a three-way merge without keeping a revision for every autosave.
- **The block index keys on (note, block ID).** Copying a block into another note never forces the server to rewrite editor content. A link that can't find its block follows the ID to wherever it moved.

## Implementation strategy

- **First proof:**
  - migrate a real-note corpus locally and read the loss report;
  - edit, save, and reload a note three times with no block-ID churn;
  - add a `[[` link and see the backlink appear.
- **Primary seam:** `app/src/lib/note-content/`.
  - `schema.ts` is the headless list of TipTap extensions, with no Solid or NodeView imports.
  - `convert.ts`: `fromHtml`, `fromMarkdown`, `toMarkdown(withIds)`, `toHtml`, `toPlainText`.
  - `ids.ts`: assign missing IDs, deduplicate within a note.
  - `project.ts`: turn a document into block, link, tag, and task rows.
  - `merge.ts`: a pure three-way merge over top-level blocks.
  - The editor adds its NodeViews on top of `schema.ts`. Server and scripts import only this folder.
- **Fast local loop:** `cd app && pnpm vitest run src/lib/note-content`. Fixture documents cover each node type: code block, image width, table, emoji, highlight, nested list, link, task.
- **Local dependencies:** Postgres from the audit harness (`visual_notes_audit_blocks`) for the dev app and the migration dry run.
- **Live confirmation:** you deploy, then run the backfill yourself, then spot-check migrated notes, share pages, and ChatGPT `get_notes`. No step in this plan touches production.
- **Rollout and rollback:**
  - `NOTE_CONTENT_READ=blocks|legacy` selects the read source during the transition.
  - Every write keeps filling `html` and `markdown`, derived from blocks, until PR 9.
  - All schema changes are additive until PR 9.

### Material dependency proof strategy

The TipTap server packages (`@tiptap/extension-unique-id`, `@tiptap/markdown`, `@tiptap/static-renderer`, `@tiptap/html`, all MIT, version 3.32) are real from the first proof. Their behavior is exactly what is under test, and it is local and deterministic.

The proof ladder: fixture round-trip tests → dry run on a real-note corpus → spot checks after deploy. Pin all `@tiptap/*` packages to one version in the same PR, so the editor and server schemas can't drift.

## Milestone 1: Bulk ingest is gone

This is a deletion-only PR, so it needs no design.

- **Change — remove the ingest paths**
  - Delete `cli-ingest/`, the `POST` handler in `app/src/routes/api/docs/index.ts`, and `app/src/routes/api/docs/inventory.ts`.
  - Keep `originalSource`, `originalContentId`, and `contentHash`. The ChatGPT connector's idempotent create (`server/mcp/notes-write.ts`) and the `chatgpt` source filter (`docs.queries.sources.ts`, `list_recent`) depend on them.
  - Delete the README and docs sections that describe ingest.
- **Change — verify**
  - `pnpm lint && pnpm type-check && pnpm test`.
  - `rg "api/docs\b|cli-ingest"` returns only historical docs.

### Desired end state

- No code path creates notes except the editor, the ChatGPT connector, and in-app AI.
- The ChatGPT create/update tests still pass.

## Milestone 2: Notes are saved and loaded as blocks

The format change itself. A note opens and saves as block JSON, and existing notes are converted. Links are not part of this PR.

- **Change — shared schema and conversion seam** (`lib/note-content/`)
  - Move the extension configuration out of `components/editor/extensions/index.ts` into a headless `schema.ts`. Add `UniqueID` with `attributeName: "id"`, covering paragraph, heading, list item, blockquote, code block, table, and image.
  - `ids.ts` assigns IDs by walking the document tree, so the server and the migration never need an editor instance.
  - Test fixtures cover each node type: HTML → JSON → HTML and JSON → markdown → JSON, preserving text and structure.
- **Change — Prisma (additive)**
  - Add to `Doc`: `content Json?`, `contentSchemaVersion Int @default(1)`, `contentVersion Int @default(0)`.
  - Add `content Json?` to `DocRevision`.
  - Create the migration with `pnpm prisma migrate dev --name doc_block_content`.
- **Change — write path** (`services/docs.actions.ts` `applyDocUpdate`)
  - The update input accepts `content`. The server validates it against the schema with ProseMirror `Node.fromJSON` plus a `check()` call, assigns any missing IDs, and increments `contentVersion`.
  - In the same write, the server derives `html` (static renderer) and `markdown`.
  - `sanitize-html` stays only on the `fromHtml` import path.
  - Markdown input from MCP and AI goes through `fromMarkdown`.
- **Change — editor** (`DocumentEditor.tsx`)
  - Load with `setContent(doc.content ?? fromHtml(doc.html || markdown))`.
  - Save with `getJSON()`.
  - The draft-unchanged check compares `contentVersion` and a JSON hash instead of the HTML string.
- **Change — revisions**
  - `services/doc-revisions.ts` snapshots and restores `content`, falling back to the legacy strings.
- **Change — migration script** (`app/scripts/migrate-block-content.ts`)
  - `--dry-run` writes a report: each note's ID, its text length before and after, the loss percentage, and any unknown tags dropped.
  - `--apply` processes notes in batches. It is idempotent and skips notes that already have `content`. It snapshots the legacy HTML into a `DocRevision` with reason `block-migration` before writing.
  - It never runs on its own.
- **Change — read switch**
  - `NOTE_CONTENT_READ` is honored by `fetchDoc` and the editor load. It defaults to `blocks`.

- **Spike — server-side `@tiptap/markdown` and `@tiptap/html`**
  - Decision required: can they parse and serialize with the shared schema outside an editor, both in the Vinxi server bundle and in a Node script?
  - Evidence to gather: a Vitest run plus one request-path call in `pnpm dev`.
  - Fallback: keep `marked` → HTML → `generateJSON` for markdown in, and write a ~150-line JSON → markdown serializer for markdown out.

### Desired end state

- A new note and an edited note both store `content`, and `html`/`markdown` stay current.
- The dry-run report on the corpus shows every note converted and lists each note that loses more than 2% of its text.
- A browser check passes: across three edit/save/reload cycles, every block ID is unchanged.

## Milestone 3: Links and backlinks (first proof)

- **Change — block index** (Prisma: `DocBlock`, `DocLink`)
  - `DocBlock(docId, id, parentId, topLevelIndex, orderIndex, type, text, tags String[], attrs Json, hash)` with primary key `(docId, id)`.
  - `DocLink(sourceDocId, sourceBlockId, targetDocId, targetBlockId?)`.
  - `project.ts` rebuilds a note's rows inside the save transaction (diff then upsert or delete). The migration and the MCP writes call the same function.
- **Change — link node and picker** (`components/editor/extensions/NoteLink.ts`)
  - An inline atom `noteLink { docId, blockId? }` whose NodeView shows the target's current title, or the heading text when it targets a block.
  - A `[[` suggestion built like `SlashCommands`, using `@tiptap/suggestion`. It searches note titles, then headings and blocks inside the chosen note, through a new `searchLinkTargets` query.
- **Change — anchors**
  - The block menu gains "Copy link to block."
  - `/docs/:id#b-:blockId` scrolls to the block and highlights it briefly.
  - A missing block falls back to the note top with a quiet notice.
  - When a link's block is gone from its target note, resolution looks up the same block ID in any note and follows it there.
- **Change — backlinks panel**
  - A section in `DocumentSidePanel.tsx`, fed by a `fetchBacklinks(docId)` query, that groups results by source note and shows the block text as context.

### Desired end state

- You insert `[[Note]]` and `[[Note#Heading]]`. Renaming the target updates both labels. The target note lists the backlink after one save.
- Cutting a block from note A and pasting it into note B keeps its ID, and links to it still resolve.
- Vitest covers the projection: duplicate IDs inside a note, a move, and a deleted target.

## Milestone 4: Every reader uses blocks

Switch the remaining readers while dual-write still gives a fallback.

- **Change — move the readers**
  - Search (`docs.queries.search.ts`) and previews (`buildDocPreviewText`, `doc-preview.ts`) read text from `DocBlock`.
  - Embeddings: `DocSection` is built from `DocBlock` rows grouped under heading blocks, replacing the markdown parsing in `embedding/preprocess.ts`.
  - The share page and OG image (`doc-shares`, `share-og.ts`) and `DocumentViewer` use the static renderer.
  - `markdown-export.ts`, `ai-run-prompt.actions.ts`, `ai-chat.actions.ts`, UMAP, and `scan-relative-images` use `toMarkdown` or `toPlainText`.
- **Spike — keep a derived text copy?**
  - Decision required: add a `Doc.plainText` cache, or aggregate `DocBlock.text` on demand?
  - Evidence to gather: time the search and embedding-run queries on the corpus both ways.
  - Fallback: aggregate on demand. Add the cache only if a query is more than 2× slower.

### Desired end state

- `rg "\.html\b|\.markdown\b"` under `app/src/services` and `app/src/server` turns up only dual-write, migration, and the read switch.
- With `NOTE_CONTENT_READ=legacy`, the app still works end to end.

## Milestone 5: Concurrent edits merge per block

- **Change — save protocol**
  - A save sends `{ content, baseVersion, baseHashes }`, where `baseHashes` maps each top-level block ID to its hash as of the last acknowledged save.
  - The server locks the row (`SELECT … FOR UPDATE`). If the version is unchanged, it writes directly. Otherwise it calls `merge.ts`.
- **Change — the merge rules** (`merge.ts`, pure)
  - Changed only on one side: take that side.
  - Changed on both sides: the incoming save wins, and the server copy is written as a `DocRevision` with reason `merge-conflict`.
  - Deleted on one side and edited on the other: the edit survives.
  - New blocks go after their nearest surviving predecessor.
  - The editor's block order is the base order.
- **Change — applying the result in the editor**
  - When the save response returns a merged document, the editor applies only the changed top-level blocks, matched by ID, in one transaction. It maps the selection, and marks the transaction `addToHistory: false`.
  - If the block holding the cursor changed, the editor waits until blur and shows "Updated elsewhere."

### Desired end state

- A Vitest table covers every rule.
- A two-tab Playwright check: edits to different blocks both survive, and a same-block conflict leaves one revision.

## Milestone 6: ChatGPT edits individual blocks

- **Change — reading**
  - `toMarkdown(withIds)` appends ` ^<id>` to each top-level block, along with link and task markers.
  - `get_notes` returns this form.
  - `note-content.ts` (Turndown) is deleted.
- **Change — writing**
  - A new `edit_note` tool with operations `replace`, `insert_after`, `delete`, and `append`, keyed by block ID.
  - The server applies them to the latest content under the row lock, increments the version, writes a revision with actor `chatgpt`, and runs the projection.
  - `update_note` and append go through the same path.
  - An unknown ID returns a clear error listing the valid IDs.
- **Change — verify**
  - Unit tests in `notes-write.test.ts`.
  - Update `scripts/mcp-smoke.ts` to read a note, edit one block, and confirm the others are byte-identical.

### Desired end state

- With the note open in the editor, a ChatGPT edit to one block appears without disturbing the block being typed in.

## Milestone 7: Checkboxes are real tasks

- **Change — data**
  - Add `sourceDocId?` and `sourceBlockId?` (indexed) to `TaskItem`.
  - `ensureInboxList()` creates the "Inbox" `TaskList` on first use.
- **Change — editor**
  - A `taskRef { taskId }` block node.
  - `[ ] ` or the slash command calls `createTask` in Inbox and inserts the node with the text you type.
  - The NodeView reads the task live (status, due date) and toggles it with `updateTask`.
  - The task's description is synced from the node text on save.
- **Change — projection**
  - On save, the source fields are set on every referenced task and cleared on any task whose block was removed. The task itself is never deleted.
  - The Tasks view shows a link back to the source note.

### Desired end state

- A task checked off in the note shows done in Tasks, and the reverse.
- Deleting the block leaves the task in Inbox with no source link.

## Milestone 8: Cross-note views

- **Change — tags**
  - An inline `#tag` node (or mark) via suggestion.
  - Tags are projected into `DocBlock.tags` with a GIN index.
  - A `/tags/[tag]` route lists matching blocks grouped by note, with links to their anchors.
- **Change — open tasks**
  - `/tasks` gets a "From notes" view of open `TaskItem`s with a `sourceDocId`, grouped by note.

### Desired end state

- Both views render through SSR and link to block anchors.
- A Playwright smoke covers route render, row click versus nested link click, and anchor highlight.

## Milestone 9: Legacy columns removed (after soak)

Start this only after the production backfill has run and you have used the app on blocks for a while.

- Stop dual-writing.
- Drop `Doc.html`, `Doc.markdown`, `DocRevision.html`, `DocRevision.markdown`, `inlineImageMigrationBackup`, the read switch, the inline-image migration admin page, and the `sanitize-html` paths that no longer have a caller.
- Keep `Doc.plainText` only if the milestone 4 spike justified it.

### Desired end state

- Blocks are the only stored content.
- Lint, type-check, and tests pass.

## Cross-cutting verification

- Every PR passes `pnpm lint && pnpm type-check && pnpm test`.
- PRs 3, 5, 7, and 8 also get a Playwright smoke on the audit harness port, covering the affected routes.

## Open decisions and spikes

- **Real-note corpus for the milestone 2 dry run.** I need a `pg_dump` of the notes restored into a local `visual_notes_audit_blocks` database. Without one, the dry run uses synthetic fixtures, and the first real loss report comes from your production `--dry-run` run, which writes nothing.
- The server-side TipTap spike (milestone 2) and the derived-text spike (milestone 4) are recorded above, each with its fallback.

## Below the cut line

- Transclusion, CRDT, presence, saved filters, and a query language.
- Time-block, archived-page, and data-table blocks.
- Converting old pasted checkbox HTML into tasks.
- Migrating link-like text in old notes into `noteLink` nodes.
- A rebuilt ingest pipeline on top of blocks.
