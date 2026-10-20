---
title: "Collections — implementation plan"
slug: "collections"
phase: plan
status: current
last_updated: "2026-10-19"
---

# Collections: implementation plan

## Plan at a glance

The work is a stack of eight PRs. Each PR is one milestone and leaves `main` shippable. Split sessions at PR boundaries if context runs long.

**Precondition:** the block-storage stack has merged through its milestone 3 (`docs/intent/block-storage`). That provides `Doc.content`, `lib/note-content/schema.ts`, and `DocBlock`. Collections touch that layer in only three places:

- creating a row note through the docs create path;
- one summary adapter that supplies a cover image and preview text;
- one embedded-view block node.

The order follows risk.

- **PR 1 proves the data model.** It covers values on `Doc`, per-property patches, and a single table, end to end on real notes. Every view depends on that model.
- **PR 2 proves the hardest UI risk: an editable grid inside a ProseMirror NodeView.** It comes early, while only the table exists, so that board, gallery, and calendar plug into a host contract that is already proven.
- **PR 3 makes the table a real tool.** It adds the query engine UI, saved views, column operations, bulk edit, footers, and virtualization at 2,000 rows.
- **PRs 4–6 add one view each.** They share the engine, the toolbar, and the editors from PR 3.
- **PR 7 brings existing notes in.**
- **PR 8 connects collections to the rest of the app.**

Pushback on the February plan:

- **No `DataTableCell` table.** Values are a JSON map on `Doc` keyed by property ID, and writes patch single keys under a row lock.
- **No server-side SQL filtering.** One pure engine filters, sorts, groups, and aggregates on both sides.
- **The relation and rollup tables are not scaffolded.** They were deferred, and empty tables would only drift.

## Implementation strategy

- **First proof:** the seeded Reading collection, with 300 rows, in a table at `/collections/:id`. Every property kind can be edited inline, a row opens into a peek panel with its note body, and edits survive a reload. The row is a normal note in search and `[[links]]`.
- **Primary seam:** `app/src/lib/collections/`. Pure and isomorphic, it imports nothing from the UI or Prisma.
  - `types.ts`: property kinds, formats, option and group shapes, view config.
  - `values.ts`: one zod schema per kind; `parseInput`, `coerce(from, to)`, `format`.
  - `query.ts`: a filter tree (AND/OR with one level of groups), per-kind operators, multi-sort, title search. Relative dates take `today` as an argument.
  - `group.ts`: board buckets and calendar day spans.
  - `aggregate.ts`: footer calculations.
  - `rank.ts`: fractional ranks for manual order.
- **Storage seam:** `services/collections/note-summary.ts` exposes `summarizeNotes(docIds) → { coverUrl?, preview }`. It reads `DocBlock`, falling back to legacy `html` if the block index is missing. It is the only collection code that touches note content.
- **Fast local loop:** `cd app && pnpm vitest run src/lib/collections`. Fixture rows cover every kind, plus null, invalid, and boundary dates.
- **Local data:** run the audit harness against database `visual_notes_audit_collections` on port 3122. Provision a blank synthetic database before starting. Seed it with `app/scripts/seed-collections.ts`, which builds:
  - Reading: 300 rows;
  - Projects: 60 rows;
  - People: 120 rows;
  - Research: 2,000 rows, as the performance gate.
- **Live confirmation:** you deploy and create one collection by hand. No step touches production data.
- **Rollout and rollback:**
  - All schema changes are additive: new tables, plus nullable `Doc.collectionId`, `Doc.properties`, and `Doc.collectionRank`.
  - Removing the nav entry and the `/collection` slash item hides the feature.
  - Reverting a PR leaves notes intact, because row bodies are ordinary notes.

There is no material external dependency. The one new package that might be needed is a virtualizer, covered by the PR 3 spike.

## Milestone 1: A collection table on real notes (first proof)

- **Change — Prisma** (`pnpm prisma migrate dev --name add_collections`)
  - `Collection(id, name, description?, icon?, deletedAt?, timestamps)`.
  - `CollectionProperty(id, collectionId, name, kind enum, config Json, position, hidden, deletedAt?)`. The config holds options `{id, name, color, group?}` and the format.
  - `CollectionView(id, collectionId, hostDocId?, name, type enum table|board|gallery|calendar, config Json, position)`.
  - On `Doc`, add `collectionId?`, `properties Json?`, and `collectionRank String?`, with an index on `[collectionId]`.
- **Change — engine core.** `types.ts`, `values.ts`, and `rank.ts`, with Vitest tables for parsing, validation, and formatting per kind.
- **Change — services** (`services/collections/`)
  - `collections.queries.ts`:
    - `fetchCollections`;
    - `fetchCollectionPage(id)`, which returns the collection, its properties, its views, and every row as `{id, title, properties, rank, createdAt, updatedAt}`.
  - `collections.actions.ts`:
    - `createCollection`, which also creates its default table view;
    - `create/update/deleteProperty`;
    - `createRow`, through the existing `createDoc` path;
    - `setRowProperties(docId, patch)`, which runs `SELECT … FOR UPDATE` and merges keys in one transaction, validating against the property kinds;
    - `renameRow`, through the existing title update;
    - `removeFromCollection`.
- **Change — UI** (`components/collections/`)
  - `routes/collections/index.tsx` and `routes/collections/[id].tsx`, kept thin.
  - `CollectionTable` holds a header with a property menu (rename, kind, format, hide, delete) and rows with cell editors split by kind:
    - `TextCell`;
    - `NumberCell`;
    - `SelectCell` and `StatusCell`, built on combobox with inline option creation;
    - `MultiSelectCell`, built on tags input;
    - `DateCell`, built on date picker with an optional end date and time;
    - `CheckboxCell`;
    - `TimestampCell`, read-only.
  - Optimistic local store, with rollback and a toast on error.
  - `RowPeekPanel` is a drawer that shows `PropertyList` above the existing `DocumentEditor`.
  - `routes/docs/[id].tsx` shows a `PropertyList` header and a breadcrumb to the collection when `collectionId` is set.
  - The sidebar nav gets a "Collections" entry.
- **Change — seed and verification.**
  - `scripts/seed-collections.ts`.
  - Vitest for `setRowProperties` merge semantics: two concurrent patches to different keys both survive.
  - A Playwright smoke: render, edit each kind, reload, open the peek, type in the body, reload.

### Desired end state

- The first proof passes: values persist, invalid input is refused with a message, and there are no hydration warnings.
- The row note appears in search and in the `[[` picker, and its backlinks work.
- **Decision:** if patches lose updates or `fetchCollectionPage` takes more than 300 ms on 300 rows, move values to a value table before PR 2.

## Milestone 2: An editable view embedded in a note

- **Change — block node.** `collectionView { viewId }` is an atom block in `lib/note-content/schema.ts`. Its NodeView renders in `components/editor/extensions/CollectionViewNode.tsx` through `createSolidNodeViewRenderer`.
- **Change — host contract.** `CollectionViewHost` loads the view by ID, renders the matching view component, and isolates its events:
  - `stopEvent` returns true for events inside the host;
  - `ignoreMutation` returns true;
  - inside the host, the `contenteditable` attribute is false;
  - no keystrokes leak into the outer document.
- **Change — insertion.** A `/collection` slash item opens a picker to choose an existing collection or create a new one. It creates a hosted `CollectionView` (`hostDocId` set) that copies the collection's default view config.
- **Change — verification.** A Playwright check in a note with text above and below the embed:
  - typing in a cell, pressing Tab/Enter/Arrow keys, and using a combobox all stay inside the grid;
  - undo in the note does not undo cell edits;
  - the note saves and reloads with the embed intact.

- **Spike — NodeView event isolation**
  - Decision required: can a fully interactive grid live inside the NodeView, or does it need a portal overlay positioned over a placeholder block?
  - Evidence to gather: the Playwright check above, plus focus behavior and IME input in a cell.
  - Fallback: render the view into a portal anchored to the block's DOM rect. The block reserves its height.

### Desired end state

- You type `/collection` in a note, choose Reading, and edit cells in place. The edits appear on the collection page.
- The block projection records the embed as a `DocBlock` of type `collectionView`.

## Milestone 3: The table is a daily tool

- **Change — engine.** `query.ts` and `aggregate.ts` get exhaustive Vitest tables, with each operator tested against null values. Status adds an "is group" operator, and dates add the relative operators (this week, past N days, next N days).
- **Change — toolbar** (`CollectionToolbar`)
  - A filter builder with AND/OR and one level of groups, multi-sort, and a search box.
  - Tabs to create, rename, duplicate, and delete views.
  - Changes save to `CollectionView.config`. Embedded views edit their own config.
- **Change — table.**
  - Resize and reorder columns, show or hide them, and freeze the title column.
  - Keyboard model: Arrow keys move, Enter edits or commits, Esc cancels, and Tab moves across cells.
  - Multi-row selection with bulk set and bulk delete.
  - A footer with aggregations per column.
  - Fixed row height with virtualized rows.
- **Change — schema editing.** Changing a property's kind runs `coerce` over every row and shows a preview ("12 values will be cleared") before applying in one transaction. Option rename, reorder, color, and delete.
- **Change — today.** The page loader returns the server's `today`, in the user's time zone from a cookie, so date filters render identically during SSR and hydration.

- **Spike — virtualization**
  - Decision required: use `@tanstack/solid-virtual`, or hand-roll fixed-height windowing?
  - Evidence to gather: scroll and edit smoothness on Research (2,000 rows), and SSR output of the first window.
  - Fallback: hand-rolled windowing. The fixed row height makes it about 80 lines.

### Desired end state

- On Research, filtering, sorting, and scrolling feel instant, and editing a cell while filtered keeps the row in place until blur.
- Footer values match the engine's tests.

## Milestone 4: Board view

- **Change.** `CollectionBoard` groups rows by a select or status property chosen in the view config, with one column per option plus "No value."
  - Card fields are configurable.
  - Dragging a card between columns sets the value. Dragging within a column sets `collectionRank` when no sort is active. The drag reuses the pointer pattern from `time-blocks/useBlockDrag.ts`.
  - "Add" in a column creates a row with that value already set.
- **Verification.** `group.ts` tests, plus a Playwright check that drags a card between columns and confirms it on reload.

### Desired end state

- Projects grouped by status works as a kanban board, both on its page and embedded in a note.

## Milestone 5: Gallery view

- **Change.** `summarizeNotes` (the storage seam) plus `CollectionGallery` cards.
  - The cover source is a view setting: none, the first image in the body, or a URL property.
  - Each card shows the title, chosen properties, and a three-line body preview.
  - Summaries load in one batched query per view.
- **Verification.** Adapter tests against fixture `DocBlock` rows and the legacy HTML fallback.

### Desired end state

- Reading shows as cover cards, and a new image in a row's body appears as its cover after save.

## Milestone 6: Calendar view

- **Change.** `CollectionCalendar` is a month grid, driven by a date property chosen in the view config.
  - Date ranges span days.
  - Dragging moves the dates and preserves the duration.
  - Clicking a day creates a row with that date.
  - A "No date" tray lists undated rows.
  - Week math reuses `time-blocks/date-utils.ts` where it fits.
- **Verification.** Span tests in `group.ts`, plus a Playwright drag-to-reschedule check.

### Desired end state

- Projects due dates and People last-contact dates read cleanly on a month grid.

## Milestone 7: Existing notes come in

- **Change.**
  - "Add to collection" in the note's property header and side panel.
  - An "Add notes" dialog in the collection that searches or picks a path, with multi-select.
  - Meta keys that match property names, compared case-insensitively, are coerced into values. Meta itself stays unchanged.
  - Moving a note to another collection carries matching values over and confirms what will be dropped.
  - Deleting a collection soft-deletes it and detaches its rows.
- **Verification.** Vitest for the meta mapping and the move mapping, plus a Playwright check that bulk-adds ten notes by path.

### Desired end state

- Existing paper notes join Research with their meta values filled in, and no note content changes.

## Milestone 8: Collections across the app

- **Change.**
  - `get_notes` (MCP) includes a row's collection and properties as a short header.
  - The notes list and search show a collection chip on rows, with a "Hide collection rows" filter (the open choice).
  - Cmd-K lists collections.
  - The README gets a section on collections.
- **Verification.** Update `scripts/mcp-smoke.ts`, then run the full `pnpm lint && pnpm type-check && pnpm test` and a Playwright route sweep across every view, on a page and embedded.

### Desired end state

- ChatGPT reads a row's properties.
- You can reach every collection from Cmd-K and the sidebar.

## Cross-cutting verification

Every PR runs `pnpm lint && pnpm type-check && pnpm test`. PRs that change interaction (1–4, 6, 7) add their Playwright smoke against the harness database. These checks run with no hydration warnings in the console.

## Open decisions and spikes

1. **NodeView isolation (PR 2).** Can the grid be interactive in place, or does it need a portal overlay? The fallback is the overlay.
2. **Virtualizer (PR 3).** Use `@tanstack/solid-virtual`, or hand-roll? The fallback is hand-rolled.
3. **Rows in the notes list.** Show them by default with a filter to hide them, or hide them by default? The default is to show them. This is your call before PR 8.

## Below the cut line

- Relations, rollups, formulas, files and attachments, and person properties.
- SQL pushdown and pagination beyond about 5,000 rows per collection.
- Garbage-collecting hosted views whose block was deleted, and restoring a deleted collection.
- Chart views, CSV import and export, and templates for new rows.
- ChatGPT tools to query or edit collections.
- Variable row heights and wrapped cells.
