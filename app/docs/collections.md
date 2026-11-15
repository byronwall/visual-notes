# Collections

Collections are typed sets of notes, like Notion databases. A row is an ordinary note (`Doc`). The collection adds a property schema on top. Every row gets search, `[[links]]`, backlinks, revisions, embeddings, and the MCP connector with no extra work. The README lists what a user can do. This page records the decisions and rules behind it.

## Scope and decisions

- **A row is a note.** There is no separate row record and no cell table. Values live on the note in `Doc.properties`, a JSON map keyed by property id. At about 2,000 rows per collection, loading every row's values is cheap, so filters and sorts run in memory.
- **One collection per note.** `Doc.collectionId` points to it. The collection owns the schema, and the note holds the values.
- **Writes patch one property.** A cell edit sets one key with `jsonb_set`, so a board drag and a table edit on the same row both survive.
- **Select values store the option id.** A renamed option shows its new name on every row.
- **Removal never deletes content.**
  - Removing a note from a collection clears `collectionId` only. Its values stay in `Doc.properties` and come back if the note is added again.
  - Deleting a property or a collection sets `deletedAt`. A deleted collection's rows become plain notes.
  - "Delete row" deletes the note. "Remove" keeps it.
- **Rows stay out of Recent by default.** `Collection.showRowsInRecent` is opt-in per collection. The notes list has a filter for collection rows.
- **One query engine, two places.** `lib/collections/query.ts` filters, sorts, and groups on the server for SSR and on the client for instant updates. "Today" uses the browser's time zone, which `lib/collections/timezone.ts` passes to the server, so both sides agree.
- **Narrow seams into note content.** Collection code reads note bodies only through `services/collections/note-summary.ts` (cover image and preview text). It embeds through one `collectionView` node in the shared note schema (`lib/note-content/schema.ts`).
- **Out of scope:** relations, rollups, formulas, file properties, charts, sharing, and SQL pushdown of filters. Tasks and time blocks stay separate from collections.

## Records

| Record                               | Rule                                                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Collection`                         | Soft delete with `deletedAt`. `showRowsInRecent` decides whether rows show in Recent and on the notes index.                                                                                                           |
| `CollectionProperty`                 | `kind` is a storage kind. `config` holds options, colors, and the display format. A format changes display only: a URL is text, and a rating is a number. Soft delete with `deletedAt`.                                |
| `CollectionView`                     | `type` is `table`, `board`, `gallery`, or `calendar`. `config` holds filters, sorts, visible properties, widths, grouping, and cover settings. A view with `hostDocId` is embedded in that note and is not a page tab. |
| `Doc.collectionId`, `Doc.properties` | Membership and values. Created and updated time are read from the note itself.                                                                                                                                         |

Property kinds: text (plain, URL, email, phone), number (plain, decimal, percent, currency, rating, progress), select, status (options grouped into To do, In progress, and Done), multi-select, date (optional end and time), checkbox, and created or updated time.

## Bringing notes in

"Add notes" on a collection page searches by title or path. "Add to collection…" is in a note's ⋯ menu. Meta keys that match property names fill those properties, and select-like kinds create missing options. Moving a note to another collection keeps the values whose name and type match, and the confirmation lists the values it drops (`lib/collections/mapping.ts`).

## Code

- `lib/collections/`: types, value parsing and conversion, the query engine, grouping, ranking for manual order, aggregates, and optimistic updates. Most unit tests live here.
- `services/collections/`: the `query()` reads and `action()` writes, membership, the note summary adapter, and the text form of a collection for agents (`collection-text.ts`).
- `server/collections/collection-store.ts`: the store that the UI and the MCP tools share.
- `components/collections/`: the page, the four views, the peek panel, the note's property header (`DocCollectionHeader.tsx`), and the embed host. Routes in `routes/collections/` only compose them.
- MCP: the `collections_*` tools. Agents can remove a note from a collection but cannot delete one (see [mcp-connector.md](mcp-connector.md)).

Logs use the `[collections]` prefix.

## Local data and tests

```sh
cd app
pnpm vitest run src/lib/collections src/services/collections
node --experimental-strip-types --env-file=.env scripts/seed-collections.ts   # audit databases only
pnpm migrate:blocks --apply                                                  # give seeded rows block bodies
```

The seed refuses any database that is not `visual_notes_audit_*`. It adds Reading and a 2,000-row Research collection. Use Research to check windowed table rows and scrolling.
