# MCP connector

The app serves an MCP endpoint at `/mcp` (Streamable HTTP, stateless, JSON responses). A connected agent, such as ChatGPT or Claude, can do nearly everything the user can in the UI: read and write notes, research topics, tasks, collections, the time-blocks calendar, events and places, and the web archive, and see recent activity. [mcp-parity.md](mcp-parity.md) maps every app action to its tool, or says why it stays with the user. Planning history lives in `docs/intent/chatgpt-mcp-notes/`.

The server is built per request in `server/mcp/tools.ts`, which makes one registrar (`tool-registry.ts`) and calls one `register*Tools` per family.

## Rules

- **Ownership.** A note belongs to the agent when `Doc.originalSource = "chatgpt"`; user edits don't change that. Agents change the body, title, or path only of their own notes. For a note the user wrote, they create a new note that links to it. `notes_get` reports `editable`. One exception: `notes_attach_file` may add attachment blocks to any note, because it only adds blocks and keeps a revision like every agent edit.
- **Metadata is open.** Task status, dates, and tags, collection values, event decisions, and note `meta` can change on any record, including the user's.
- **Deleting stays with the user**, and so do reviewing research summaries and layout choices (canvas positions, column widths, manual order, calendar settings). Agents cancel a task or a show, hide research cards (undoably), or remove a note from a collection instead.
- **Every write is visible.** It logs an `ActionEvent` with `actorType = "chatgpt"` (shown "via <client name>" in the activity timeline), and publishes a live update so open tabs refresh (see [Live updates](#live-updates)).
- **Every call is recorded.** The registrar logs one `mcp.call.<ok|refused|failed|denied>` `ActionEvent` per tool call (`server/mcp/call-log.ts`): the tool is `entityId`, the call id is `requestId`, and the payload holds the client name (`agent`), trimmed arguments, duration, refusal code, and, for writes, how many events the call caused. Domain events logged during the call get the same `requestId` and `agent` through `server/events/event-scope.ts`, so tool families never pass them along. The Activity page's **MCP** tab shows these calls with a summary of clients and top tools; the **All** tab and `activity_query` leave them out unless asked (`domain: "mcp"`).
- **Writes go through the app's stores.** Note bodies go through `server/notes/note-write.ts` / `note-store.ts`, tasks through `server/tasks/task-store.ts`, collections through `server/collections/collection-store.ts`, time blocks through `server/time-blocks/time-block-store.ts`, events and places through `server/calendar/event-store.ts` / `place-store.ts`, and the archive through `server/archive/archive-store.ts`. The connector never has its own write path.

## Tools

64 tools. Reads need the `notes:read` scope and writes need `notes:write`.

Every family registers through `tools.read` / `tools.write` in `server/mcp/tool-registry.ts`. That registrar sets the scope from read vs. write, the annotations, the `[mcp]` log line, and how store errors become refusals. ZodError, `ResearchIngestError`, `TimeBlockInputError`, and plain "not found" / "invalid" errors become `invalid` or `not_found`. Each family file exports one `register*Tools(tools)` and a line for the server instructions. `handler.ts` derives the per-tool `securitySchemes` from the same read/write annotation, so there is no scope table to keep in sync.

### Conventions

Agents get the same answer shapes from every family:

- **Names** are `<area>_<verb>[_<object>]`: `notes_`, `research_`, `tasks_`, `collections_`, `time_blocks_`, `events_`, `places_`, `archive_`, `activity_`. `search` is the one cross-area tool.
- **Verbs**: `list` enumerates a small set (lists, paths, tags, topics, places). `query` finds a family's items with filters. `get` reads by id. `create`, `update`, and `set` write. `add` and `remove` change membership. `upload` stores a file and says where it lives.
- **Ids**: a tool's own records are `id` / `ids`. Records in other areas are `noteId`, `listId`, `showId`, `pageId`, `parentTaskId`. An event is addressed by its note's `noteId`.
- **Links**: `appUrl` always opens the record in Visual Notes. `url` is always a web address: a research source, an event's ticket page, an archived page.
- **Results** are JSON objects. Lists sit under a named key (`{ notes }`, `{ tasks }`, `{ rows }`), never bare. `truncated` says a limit cut the list.
- **Linked notes** read `{ id, title, appUrl }` wherever they appear (tasks, time blocks, search groups).
- **Who wrote a note** is `createdBy: "agent" | "user"`; `editable` on `notes_get` says whether the agent may change the body.
- **Refusals** are `code: message`, with codes `not_found`, `not_owner`, `invalid`, and `duplicate`. A batch refusal starts with `Nothing was written. Fix these and retry:` and lists every problem.

### Notes

| Tool                | Kind  | Notes                                                                                                                                                                                                                                                                                     |
| ------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`            | read  | Keyword search (the app's `searchDocs`) fused with meaning-based matches; each note says `match: keyword`, `semantic`, or `both`. Always returns `{ notes }`; `include: ["research", "tasks", "archive"]` (any subset) adds one group per kind matched by the words (`search-groups.ts`). |
| `notes_query`       | read  | Newest first; filter by `since`, `path`, `createdBy: "agent" \| "user"`                                                                                                                                                                                                                   |
| `notes_list_paths`  | read  | Dot-path tree with direct and total counts                                                                                                                                                                                                                                                |
| `notes_get`         | read  | Up to 10 notes as markdown with block ids, `meta`, `editable`, collection values, and `embeds`; unknown ids under `missing`                                                                                                                                                               |
| `notes_create`      | write | Any path, new or existing; `idempotencyKey` makes retries safe                                                                                                                                                                                                                            |
| `notes_update`      | write | Replace title, path, and/or markdown. Agent notes only.                                                                                                                                                                                                                                   |
| `notes_append`      | write | Add markdown at the end. Agent notes only.                                                                                                                                                                                                                                                |
| `notes_edit_blocks` | write | `replace`, `insert_after`, or `delete` blocks by id; other blocks stay byte-identical. Agent notes only.                                                                                                                                                                                  |

| `notes_upload_image` | write | Store an image from `file` (a ChatGPT file), `data` (base64 or a data URL), or `url` (downloaded by the server); returns `{ url, src, markdown, mime, bytes }` to embed with a note write. Changes no note. |
| `notes_attach_file` | write | Store any file from `files` (ChatGPT files), `data` + `name`, or `url`, and with `noteId` add it to that note (any note) as an attachment card, at the end or after `afterBlockId`. Returns `attached` (`name`, `display`, `mime`, `bytes`, `src`, `url`, `markdown`, `blockId`) and `note`. |

Each note write snapshots a `DocRevision` first and logs `doc.create` or `doc.update`.

### Images

Agent images are stored like the app's own: content-addressed files in `DOC_IMAGE_STORAGE_DIR`, served from `/api/doc-images/<sha256>.<ext>` (`server/mcp/note-images.ts`, which reuses `persistImageBuffer` from `server/lib/inline-image-migration.ts`).

- **`notes_upload_image`** is the way in. It stores the bytes and returns markdown (`![alt](/api/doc-images/…)`) for `notes_create`, `notes_append`, or `notes_edit_blocks`, so ownership stays with those tools. The same bytes always give the same `src`. It logs no activity event of its own; the note write that embeds the image does.
- **Accepted**: PNG, JPEG, GIF, WebP, AVIF, HEIC (also stored as JPEG), and BMP, up to 10 MB, sniffed from the bytes. SVG is refused, because a file served from the app's origin can run script.
- **`url` uploads** go through `fetchPublicFile` (`server/lib/public-fetch.ts`): http(s) only, at most 3 redirects, 15 s, and every address is checked when the socket connects, so loopback, private, link-local, and metadata addresses are refused even after a redirect or a DNS change.
- **Inline `data:image/…` sources** in any note write's markdown are stored the same way before parsing, so a note body never holds base64. Other image urls stay as links to that site; agents that want a lasting copy upload them first.

### Files

Attachments are content-addressed files in `DOC_FILE_STORAGE_DIR` (default `app/data/doc-files`), served from `/api/doc-files/<sha256>/<file name>`. See [note-files.md](note-files.md) for storage, serving, and the editor side.

- **ChatGPT hands files over by reference.** `notes_attach_file` lists `files` in `_meta["openai/fileParams"]` (and `notes_upload_image` lists `file`), so ChatGPT fills them with `{ download_url, file_id, mime_type?, file_name? }` for files the user uploaded or shared, instead of the model copying bytes into base64. The schema has exactly those four properties with the first two required; ChatGPT's tool scan rejects any other shape (`note-files-tools.test.ts` checks it). The server downloads the url through `fetchPublicFile`.
- **Other clients** pass `data` (base64 or a data URL) with `name`, or a public `url`. A name without an extension gets one from the bytes or `mimeType`.
- **Pictures** (PNG, JPEG, GIF, WebP, AVIF, HEIC, BMP up to 10 MB) go to `/api/doc-images` and show inline unless `display: "file"`; everything else becomes a card. Up to 10 files per call, 50 MB each.
- **Attaching to a note** (`noteId`) goes through `attachToNote` in `notes-write.ts`: one transaction, a `chatgpt.attach` revision, and `doc.update`. A file whose `src` is already a block in the note is not added again; its `blockId` comes back with `alreadyAttached: true`, so a retried call is safe.
- **In markdown** an attachment is `[name](/api/doc-files/<hash>/<name>)` alone on its line. Every note write checks that a new one points at a stored file (else nothing is written) and fills in its type and size. `notes_get` lists them under `attachments` with a full `url`.

### Note context

What surrounds a note, read from the same views the note page and Tags page use (`server/notes/note-links.ts`, `note-views.ts`, `note-revisions.ts`, `note-meta.ts`). Open task lines in notes are `tasks_query` with `inNotes: true`.

| Tool                     | Kind  | Notes                                                                                |
| ------------------------ | ----- | ------------------------------------------------------------------------------------ |
| `notes_get_backlinks`    | read  | Notes linking to a note or its blocks, with the linking text                         |
| `notes_list_tags`        | read  | Every tag with counts, or with `tag`, the blocks carrying it grouped by note         |
| `notes_list_revisions`   | read  | Saved versions, newest first, with the reason each was kept                          |
| `notes_restore_revision` | write | Agent notes only. Snapshots the current version first, like the note page's restore. |
| `notes_list_meta_keys`   | read  | Meta field names in use with counts, or with `key`, the values it holds              |
| `notes_set_meta`         | write | Set or remove flat `meta` fields on up to 50 notes, any owner. Content is untouched. |

### Research

Research topics are canvases of cards (see [research-threads.md](research-threads.md)). Every card write goes through `writeBatch` in `research-shared.ts`: a batch in the topic's history, recorded with the caller (`actorId`, or the `agent` argument), that the user can undo. Batch writes return `{ batchId, batchKey, replayed, …, appUrl }`.

| Tool                                          | Kind  | Notes                                                                                                                                 |
| --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `research_list_topics`                        | read  | Open/card counts, top accepted summary, link; `includeArchived`                                                                       |
| `research_get_topic`                          | read  | Markdown with card ids: summaries, the open frontier with the chain each came from, recent batches; `depth: "full"` for every card    |
| `research_get_card`                           | read  | One card in full, what it led to, and what a summary covers                                                                           |
| `research_list_batches`                       | read  | The topic's history with batch ids and undone flags                                                                                   |
| `research_create_topic`                       | write | One topic = one canvas                                                                                                                |
| `research_update_topic`                       | write | Rename and/or archive                                                                                                                 |
| `research_add_cards`                          | write | Nested cards, links, and draft summaries as one transactional batch (one card, or only links, is fine); `batchKey` makes retries safe |
| `research_set_card_states`                    | write | Open, done, or dropped                                                                                                                |
| `research_update_cards`                       | write | Title, body, url, snippet, imageUrl of existing cards                                                                                 |
| `research_remove_cards`                       | write | Hide cards; a card with children goes only with them                                                                                  |
| `research_undo_batch` / `research_redo_batch` | write | By batch id or `batchKey`; refused while later batches build on it                                                                    |

Writes log `research.*` events. Accepting summaries, nudges, and dragging cards stay with the user.

### Tasks

| Tool                                      | Kind  | Notes                                                                                                            |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `tasks_list_lists`                        | read  | Lists in rail order with open and total counts                                                                   |
| `tasks_query`                             | read  | Filter by list (id or name), status (open by default), due range, tag, `noteId`, `inNotes`, text, top level only |
| `tasks_create`                            | write | Inbox when no list is given; optional parent, due date, duration, tags, meta                                     |
| `tasks_update`                            | write | Up to 50 tasks: status, description, due date, duration, tags, meta                                              |
| `tasks_move`                              | write | To another list (with its subtasks), or to a new parent and position                                             |
| `tasks_create_list` / `tasks_rename_list` | write |                                                                                                                  |

A task that is a line in a note the user wrote (`textEditable: false`) keeps its text; its status, dates, tags, and place can still change. Agents set `cancelled` instead of deleting. A list named by a name several lists share is refused with their ids. Writes log `task.*` and `task_list.*` events. The Tasks page's own edits are not logged.

### Collections

Rows are notes, so a new row is a note the agent owns. Agents name properties and options and send plain text (`"In progress"`, `"2026-11-01"`, `["a", "b"]`); `collections-agent.ts` maps those to ids, the same way paste does on the collection page. Missing option names are created. `events_create` writes its `values` through the same path.

| Tool                                                       | Kind  | Notes                                                                                                                                                           |
| ---------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections_list` / `collections_get`                     | read  | Collections with counts; schema with kinds, options, and views                                                                                                  |
| `collections_query`                                        | read  | Start from a saved `view`, then add `where` (`{ property, op, value }`, all must match), `sort`, and `search`. Values come back as text.                        |
| `collections_create` / `collections_update`                | write | New collection (Status, Tags, plus any properties); rename or describe                                                                                          |
| `collections_add_property` / `collections_update_property` | write | Add a property; rename one or add options                                                                                                                       |
| `collections_add_row`                                      | write | A new note in the collection with values; the body is optional                                                                                                  |
| `collections_set_values`                                   | write | Up to 200 rows, each with its own values; validated before anything is written                                                                                  |
| `collections_add_notes` / `collections_remove_notes`       | write | Membership. Moving carries values by name; removing keeps them stored.                                                                                          |
| `collections_create_view`                                  | write | Table, board, gallery, or calendar with filters and sorts. With `hostNoteId` (an agent note), it returns the `{{collection-view:id}}` line to put in that note. |

Changing a view, property kinds, and manual order stays with the user. Writes log `collection.*` events. `notes_get` reports a row's `collectionId` next to its values.

### Time blocks

| Tool                        | Kind  | Notes                                                                                                                                                          |
| --------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time_blocks_query`         | read  | Blocks and day values for `from`..`to` (days, both included; the next 7 days by default), plus the calendar's `timeZone`; `noteId` for blocks linked to a note |
| `time_blocks_create`        | write | Title, ISO start/end with offset, fixed or flexible, color, comments, linked note                                                                              |
| `time_blocks_update`        | write | Up to 50 blocks; validated before anything is written                                                                                                          |
| `time_blocks_set_day_value` | write | One value per day, key, and contributor; sets or replaces                                                                                                      |

Bare `YYYY-MM-DD` days use the server's time zone, the same local midnight the calendar stores for day values. Writes log `time_block.*` and `time_block_day.*` events (Calendar in the activity filter).

### Events and places

An event is a note with dated shows, a place, and decisions. Tools address the event by its `noteId` and each show by `showId`. Event dates are local to `DEFAULT_TIME_ZONE` (`lib/events/types.ts`) unless a show passes `timeZone`, and `events_query` reports that zone.

| Tool                     | Kind  | Notes                                                                                                                                              |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events_query`           | read  | Upcoming shows, one row each, oldest first; filter by day range, collection, effective decisions, place, title text                                |
| `events_get`             | read  | One event with every show in local terms and its collection values                                                                                 |
| `events_find_duplicates` | read  | Likely matches by canonical URL, title, and show dates. Call before `events_create`.                                                               |
| `events_create`          | write | Note, details, place, shows and/or a repeat rule, optionally as a collection row with `values`. Refuses likely duplicates unless `allowDuplicate`. |
| `events_update`          | write | Web url, summary, place, decision, decisionNote; makes a note an event if it isn't one                                                             |
| `events_add_shows`       | write | A list and/or a repeat rule; repeat dates already present are skipped                                                                              |
| `events_update_show`     | write | One show's date/time, place, ticket status, status, decision. A show that was called off gets `status: "cancelled"`.                               |
| `events_list_feeds`      | read  | Calendar feeds and their selection rule; subscribe tokens never leave the server                                                                   |
| `places_list`            | read  | Places with address and coordinates                                                                                                                |
| `places_upsert`          | write | Find by normalized name + city or create; `update` patches a match, `geocode` asks OpenStreetMap                                                   |

Writes log `event.*` events (Events in the activity filter) and publish the `events` live area. Deleting events, shows, and places stays with the user.

### Web archive

Snapshot HTML stays on disk; agents get the stored text snippets.

| Tool               | Kind  | Notes                                                                                 |
| ------------------ | ----- | ------------------------------------------------------------------------------------- |
| `archive_query`    | read  | Pages by words in the title, url, or notes, plus group, hostname, capture date        |
| `archive_get`      | read  | One page with all its notes, by `id` or by `url` (`archived: false` when never saved) |
| `archive_add_note` | write | A text note (and optional image url) on a saved page; logs `archive.note_added`       |

Capturing, retitling, regrouping, editing or deleting pages and notes, and the archive canvas stay with the user.

### Activity

| Tool             | Kind | Notes                                                                                                                                                                                                                                                                      |
| ---------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activity_query` | read | The Activity page's timeline since a time (24 hours by default), optionally for one domain (`doc`, `task`, `research`, `collection`, `time_block`, `event`, `archive`, …) or one `noteId`. Each event is the page's one-line summary, with `via` set when an agent did it. |

## Markdown dialect

`notes_get` and every note write use one markdown dialect, parsed by `fromNoteMarkdown` in `lib/note-content/note-markdown.ts` (the inverse of `toMarkdown`). Imports and legacy rows still go through plain `fromMarkdown`.

| Markdown                                               | Becomes                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ` ^a1B2c3D4e5` at the end of a block (read only)       | The block id for `notes_edit_blocks`. Code blocks and tables have it on the next line. Agents never send these.                                                 |
| `- [ ] text` / `- [x] text` (top level)                | A task line backed by a `TaskItem` in the Inbox list. Rewriting a line keeps its task (same block id, else same text), and the checkbox sets the task's status. |
| `[[Label\|noteId]]`, `[[Label\|noteId#blockId]]`       | A note link (and a `DocLink` backlink). New links to missing notes are refused.                                                                                 |
| `#tag` (starting with a letter)                        | A tag on that block. `#42` stays text.                                                                                                                          |
| `{{collection-view:viewId}}` on its own line           | An embedded collection view. `notes_get` names each one under `embeds`.                                                                                         |
| `[name](/api/doc-files/<hash>/<name>)` on its own line | A file attachment card. The file must already be stored (`notes_attach_file`). `notes_get` lists each one under `attachments`.                                  |
| `\#`, `\[`, `\]`                                       | The literal character. `toMarkdown` escapes these itself.                                                                                                       |

## Live updates

Every agent write reaches open tabs over the `/ws/notes` socket ([live-note-updates.md](live-note-updates.md)). Note writes publish `notes:changed` through the Prisma extension on `Doc`. Other writes call `publishAppChange(area, ids)` for `research`, `tasks`, `collections`, `time-blocks`, `archive`, or `events`, and the open page revalidates that area. Pages that save locally skip their own echo (Tasks for 2 seconds; the calendar while a write or drag is in flight).

## Meaning-based search

When `OPENAI_API_KEY` is set and at least one embedding run exists (`/embeddings`), `search` also embeds the query with the newest run's model. It then ranks notes by cosine similarity against that run's doc vectors and merges the two lists with reciprocal rank fusion. Hits below a 0.25 similarity are dropped.

- Doc vectors are loaded into memory once and reloaded only when the run's embedding count or newest row changes.
- After any connector write, the app waits 10 seconds and then embeds up to 25 missing and 25 changed notes into the newest run, using the same pipeline as a manual run. A note the agent just saved therefore becomes findable by meaning shortly after the save.
- Without a key or a run, or if the provider call fails, `search` falls back to keyword-only results.

## Configuration

| Variable                | Purpose                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `MCP_CONNECTOR_ENABLED` | `true` serves `/mcp` (and the OAuth routes). Anything else returns 404. This is the kill switch.       |
| `MCP_TOKEN_SECRET`      | HMAC secret for access tokens. Rotating it invalidates every issued access token.                      |
| `MCP_DEV_TOKEN`         | Static bearer for local runs (smoke script, Inspector, e2e specs). Ignored when `NODE_ENV=production`. |
| `PUBLIC_BASE_URL`       | Origin used for links in tool results.                                                                 |

## OAuth

ChatGPT connects with OAuth 2.1, served by the app itself for its single user:

| Endpoint                                      | Purpose                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/oauth-protected-resource[/mcp]` | RFC 9728 metadata. Served from middleware, because the file router skips dot-folders.                                                                |
| `/.well-known/oauth-authorization-server`     | RFC 8414 metadata: S256 PKCE, dynamic registration, `iss` on responses                                                                               |
| `/oauth/register`                             | RFC 7591 dynamic client registration. Public clients only. Redirects must be HTTPS, or loopback HTTP for native apps such as Claude Code (RFC 8252). |
| `/oauth/authorize`                            | Requires the normal login (via `/login?next=…`), then shows a consent page                                                                           |
| `/oauth/token`                                | `authorization_code` with PKCE, and rotating `refresh_token`                                                                                         |

- Access tokens are HS256 JWTs. They live for one hour, have `aud` set to `<origin>/mcp`, and carry the grant id. `/mcp` checks the signature, `iss`, `aud`, `exp`, and that the grant is not revoked, on every call.
- Codes and refresh tokens are stored only as SHA-256 hashes. Codes are single use. A refresh token that has already been rotated is refused.
- `tools/list` adds a per-tool `securitySchemes` entry, which ChatGPT reads and the MCP SDK doesn't emit. A call without the needed scope returns the `mcp/www_authenticate` challenge that makes ChatGPT offer to reconnect.
- Revoke one connection at `/admin/connections`. To revoke everything, rotate `MCP_TOKEN_SECRET`.

## Testing

- **Unit and DB tests** live next to the tools in `server/mcp/`. `*.db.test.ts` files connect a real `McpServer` to the official client over `InMemoryTransport` and run against `TEST_DATABASE_URL` (they skip without it):

  ```sh
  cd app
  TEST_DATABASE_URL=postgresql://…/visual_notes_ci pnpm test src/server/mcp
  ```

- **Smoke script.** `scripts/mcp-smoke.ts` uses the official MCP client over HTTP. It checks the tool list and that every tool follows the naming convention, then one read and one write per family. Everything it creates is named `mcp-smoke <run id>` (notes under the `mcp-smoke.run-<id>` path). It cancels its task and removes its rows from the collection, but deleting is human-only, so the rest stays as clearly named fixtures. Run it only against a local or disposable database:

  ```sh
  MCP_URL=http://127.0.0.1:<port>/mcp MCP_BEARER=<MCP_DEV_TOKEN> \
    node --experimental-strip-types scripts/mcp-smoke.ts [--human-note <id of a user-written note>]
  ```

- **Browser specs** drive `/mcp` while a page is open and check that it refreshes: `research-editing`, `task-agent-sync`, `time-blocks-agent-sync`, `archive-agent-sync`, and `live-note-updates` in `tests/e2e/`. They need `MCP_DEV_TOKEN`, so they skip in CI's production build. Run them against the [audit harness](audit-harness.md) with `PLAYWRIGHT_BASE_URL`, `MCP_DEV_TOKEN`, `RESEARCH_AGENT_TOKEN`, and `PLAYWRIGHT_MAGIC_PASSWORD_FILE` set. `archive-agent-sync` also needs `ARCHIVE_INGEST_TOKEN` for its page fixture.
- **Interactively:** `pnpm dlx @modelcontextprotocol/inspector`, connected to the same URL with the bearer header.

## Deploying and connecting ChatGPT or Claude

1. Set these on the production app, then deploy. The migrations run at container start.
   - `MCP_CONNECTOR_ENABLED=true`
   - `MCP_TOKEN_SECRET=$(openssl rand -hex 32)`
   - `PUBLIC_BASE_URL=https://<your notes origin>`. Tokens are issued for `<origin>/mcp`, so this must be the public HTTPS URL.
2. Check from outside:
   - `curl https://<origin>/.well-known/oauth-protected-resource/mcp` returns `resource: https://<origin>/mcp`.
   - `curl -i -X POST https://<origin>/mcp` returns `401` with a `WWW-Authenticate` header that has `resource_metadata`.
3. In Claude Code, add the server once for every project with `claude mcp add --scope user --transport http visual-notes https://<origin>/mcp`, then choose Authenticate under `/mcp`. Claude Code registers a loopback callback such as `http://localhost:52986/callback`; later sign-ins may use another port, which `/oauth/authorize` accepts for loopback redirects only.
4. In ChatGPT, turn on developer mode (Settings → Apps & Connectors → Advanced). Create a connector with the URL `https://<origin>/mcp` and OAuth authentication. ChatGPT registers itself, then opens the Visual Notes login and consent page. Approve it.
5. Smoke test in a chat:
   - "Save a short plan about X to my notes." Expect a title, a path (possibly new), and a link that opens in the app.
   - In a new chat: "Find what we saved about X and add a next step." Expect `search` → `notes_get` → `notes_edit_blocks`/`notes_append`, and a version row for the edit.
   - "Rename my note <title of a note you wrote>." Expect a refusal and an offer to create a linked note.
   - "What's open on my task list this week?" Expect `tasks_query`.
6. Watch the `[mcp]` and `[oauth]` log lines during the run.

Rollback: set `MCP_CONNECTOR_ENABLED=false`. `/mcp`, `/oauth/*`, and the metadata routes then return 404, and ChatGPT reports the connector unavailable. Everything already saved stays as normal app data.
