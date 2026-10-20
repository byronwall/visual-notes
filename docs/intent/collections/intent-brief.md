---
title: "Collections (Notion-style databases)"
slug: "collections"
phase: intent
status: current
last_updated: "2026-10-19"
---

# Collections (Notion-style databases)

## My read

You want to keep collections of similar things in Visual Notes: books and papers, projects and work items, people, research sources and ideas. Each item should have scannable structured details and a full note body. The model is Notion's database: one dataset with typed properties, shown as a table, a board, a gallery, or a calendar. Each row opens into a page.

The February PRD and phase plan aimed at the same outcome. They were written before notes moved to blocks, and they treated rows as separate records with an optional note attached. That premise has changed. **A row is a note.** It is a full Doc with block content, and the collection adds a property schema on top. Every row then gets search, `[[links]]`, backlinks, embeddings, revisions, and ChatGPT access with no extra work.

The note storage layer is mid-migration to blocks. The collection features (UI, views, and property storage) should be built so they depend on that layer through only a few narrow seams. The block work will be merged by the time implementation starts.

## What matters most

- Rows are first-class notes, and the structured details sit on top of them rather than beside them.
- The grid is fast to edit: typing, tabbing, and changing a status feel spreadsheet-quick.
- One dataset can be seen many ways: table, board, gallery, and calendar views over the same rows, each with its own filters and sorts.
- Collections show up where you write. A note can embed a live, fully editable view of a collection.
- The property set is broad enough for all four first uses, without becoming a long list of special-case types.

## The experience you appear to want

You create a "Reading" collection and add Status, Rating, Author, URL, Tags, and Finished properties. You type rows into the table, switch to a board grouped by status, and drag a book to "Done." Opening a row shows its properties above a normal note body, where you write your notes on the book. In your weekly review note, you embed the Reading board filtered to "In progress" and update it there. Existing notes about papers can be pulled into a Research collection, and their meta values carry over.

## Boundaries

### Must be true

- Each note belongs to at most one collection. The collection owns the schema, and the note holds the values.
- Removing a note from a collection, deleting a property, or deleting a collection never deletes note content.
- Embedded views are fully editable, not read-only snapshots.
- The work ships as stacked PRs that each leave `main` shippable, starting tonight. Sessions may be split for context.
- It follows the SSR-first SolidStart conventions: no hydration mismatches and no client-only grid shells.

### Must be avoided

- A second, parallel note system for row bodies.
- Coupling collection code to the internals of note content, which is still changing.
- Overbuilding: no relations, rollups, or formulas in this build.

## What seems settled

- Rows are notes, with one collection per note. Existing notes can be added to a collection.
- Collections have their own pages and can also be embedded in notes as editable views.
- This build includes the table, board, gallery, and calendar views.
- Relations, rollups, and formulas are deferred.
- Tasks and time blocks stay separate, and no convergence is planned.
- The first uses are reading and media, projects and work items, people, and research.

## Possibilities, not decisions

- The exact property list. A compare-and-contrast pass favored a few storage kinds with display formats, such as a URL format on text or a rating format on number, over many special types.
- Where gallery covers come from, such as the first image in the row body.
- Whether collection rows appear in the main notes list by default.

## Current reality that matters

- `Doc.meta` already stores loose key/value pairs. It is the natural source when existing notes are mapped into properties.
- The app has a single user, and `Doc` has no `userId`, so ownership needs no design.
- The block-storage plan adds `Doc.content` (TipTap JSON with block IDs), a headless shared schema, and a `DocBlock` index. Data-table blocks are listed there as a later possibility, and this initiative covers them.
- Ark/Park UI wrappers for select, combobox, date picker, tags input, rating group, and menu already exist. Time blocks already have pointer-drag and calendar geometry code.

## Next step after confirmation

The shape and the implementation plan are drafted alongside this brief.
