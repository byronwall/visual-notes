---
title: "Collections — shape brief"
slug: "collections"
phase: shape
status: current
last_updated: "2026-10-19"
---

# Collections: what we are adding

**Outcome:** Notes can be grouped into typed collections. You can see a collection as a table, a board, a gallery, or a calendar, on its own page or embedded and editable inside any note.

**Primary flow:** create a collection → define its properties → add rows in the table (each row is a note) → open a row to write its body → save views with filters and sorts → embed a view in a note and keep editing there.

## Feature scope

```text
Collections
├── PLANNED ADDITIONS
│   ├── Collection pages
│   │   ├── /collections index; /collections/:id with view tabs
│   │   └── New rows are new notes; "Delete row" deletes the note, "Remove" keeps it
│   ├── Property types (storage kinds; formats change display only)
│   │   ├── Title (the note title) · Text: plain / URL / email / phone
│   │   ├── Number: plain / decimal / percent / currency / rating 1–5 / progress
│   │   ├── Select · Status (select options grouped To do / Doing / Done) · Multi-select
│   │   ├── Date: optional end, optional time · Checkbox
│   │   └── Created time · Updated time (read from the note)
│   ├── Schema editing
│   │   ├── Add, rename, reorder, hide, delete properties; inline option creation with colors
│   │   └── Type change that converts values, with a preview of values that will be cleared
│   ├── Views (each one saved, with its own filters, sorts, and search)
│   │   ├── Table: inline cell editors, keyboard navigation, resize/reorder columns,
│   │   │   multi-row select with bulk set, footer counts/sum/avg/min/max, virtualized rows
│   │   ├── Board: grouped by select or status; drag changes the value; manual order in a column
│   │   ├── Gallery: cards with a cover (first body image or a URL property) and a body preview
│   │   └── Calendar: month grid by a date property; ranges span days; drag to reschedule
│   ├── Rows as notes
│   │   ├── Peek panel: properties above the full note editor
│   │   └── The note page shows an editable property header and a link back to its collection
│   ├── Embedded views
│   │   └── /collection block in any note: pick or create a collection, fully editable, with its own view config
│   └── Bringing notes in
│       ├── "Add to collection" on a note; bulk add by search or path
│       └── Note meta keys that match property names fill those properties
├── EVALUATE BEFORE COMMITTING
│   ├── Hiding collection rows from the main notes list by default
│   └── Default path for new rows (e.g. a collection's own path)
└── LATER POSSIBILITIES
    └── Relations · rollups · formulas · files · charts · collection query tools for ChatGPT
```

## Behavior

| Situation | Expected result |
| --- | --- |
| A note is removed from a collection | It stays a normal note. Its stored values are kept and come back if the note is re-added |
| A note moves to another collection | Values carry over where the name and type match; a confirmation lists what will be dropped |
| A property is deleted | It is hidden everywhere at once; values stay in storage until a later cleanup |
| A collection is deleted | Its rows become plain notes; no note content is touched |
| Board drag and a table edit hit the same row | Both survive, because writes patch individual properties, not the whole row |
| A select option is renamed | Every row shows the new name, because values store the option's ID |
| A "this week" filter is evaluated | "Today" comes from the server render, so SSR and the client agree |

## Decisions and boundaries

**Appetite:** Tonight, as eight stacked PRs. Each one leaves `main` shippable, and sessions may be split between PRs.

**Key decision: values live on the note.** `Doc` gets `collectionId` and a `properties` JSON map. Collections, properties, and views get their own tables. The old plan used a separate cell table with typed columns. That table would have duplicated the "row is a note" identity, and it only pays off for SQL filtering at a scale beyond your collections. One shared filter/sort/group engine runs on the server for SSR and on the client for instant updates. At about 2,000 rows per collection, loading every row's properties is cheap.

**Key decision: a few seams into note storage.** Collection code reads note content only through one summary adapter (cover image and preview text). It embeds through one block node registered in the shared schema. That keeps it stable while the block layer settles.

**Boundary:** No relations, formulas, sharing, or SQL pushdown. Tasks and time blocks are unchanged. Every schema change is additive, and the collections nav entry can be hidden to disable the feature.

**First proof:**
- **Try:** a seeded 300-row Reading collection with a table on its own page. Edit every property kind, and open a row to write its body.
- **Observe:**
  - values survive a reload, and invalid input is rejected;
  - the row is found by search, can be `[[linked]]`, and shows backlinks;
  - cell commits feel instant;
  - there are no hydration warnings.
- **Decide:** if per-property patches on `Doc.properties` cause lost updates or slow reads, move values into a value table before building views on top.

**Open choice:** Whether collection rows show in the main notes list and recent notes by default. The default is to show them, with a filter to hide them.

Intent: [intent-brief.md](intent-brief.md) · Plan: [implementation-plan.md](implementation-plan.md)
