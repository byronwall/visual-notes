# ChatGPT MCP connector

The app serves an MCP endpoint at `/mcp` (Streamable HTTP, stateless, JSON responses) so ChatGPT can save notes and find them later. Planning history lives in `docs/intent/chatgpt-mcp-notes/`.

## Tools

| Tool | Kind | Notes |
| --- | --- | --- |
| `search` | read | Keyword search (the app's `searchDocs`) fused with meaning-based matches. Each result carries `match: keyword | semantic | both`. |
| `list_recent` | read | Newest first; filter by `since`, `path`, `createdBy: "chatgpt"` |
| `list_paths` | read | Dot-path tree with direct and total counts |
| `get_notes` | read | Up to 10 notes as markdown; editor HTML is converted with turndown |
| `create_note` | write | Any path; `idempotencyKey` makes retries safe |
| `update_note` | write | ChatGPT-created notes only; snapshots a `DocRevision` first |
| `append_to_note` | write | Same ownership rule; keeps existing HTML intact |

### Research tools

The same server exposes research topics (see [research-threads.md](research-threads.md)). Reads need `notes:read` and writes need `notes:write`, so a connected ChatGPT can use them without reconnecting.

| Tool | Kind | Notes |
| --- | --- | --- |
| `research_list_topics` | read | Topics with open/card counts, top accepted summary, and link |
| `research_read_topic` | read | Markdown with card ids: summaries, the open frontier with pedigree, recent batches; `depth: "full"` for every card |
| `research_list_frontier` | read | Open tasks/questions with the chain each came from |
| `research_get_card` | read | One card in full, what it led to, and what a summary covers |
| `research_create_topic` | write | One topic = one canvas |
| `research_ingest_tree` | write | Nested cards, links, and draft summaries as one transactional, undoable batch; `batchKey` makes retries safe |
| `research_add_card` / `research_link_cards` | write | One-card and one-link shortcuts over the same ingest |
| `research_set_state` | write | Open/done/dropped as an undoable batch |
| `research_update_cards` | write | Title, body, url, snippet, imageUrl of existing cards, as an undoable batch |
| `research_remove_cards` | write | Hide cards as an undoable batch; a card with children goes only with them |
| `research_list_batches` | read | The topic's history with batch ids and undone flags |
| `research_undo_batch` / `research_redo_batch` | write | By batch id or batchKey; refused while later batches build on it |
| `research_update_topic` | write | Rename and/or archive; `research_list_topics` takes `includeArchived` |

Research writes record the caller (`actorId`, or the `agent` argument) on the batch shown in the topic's history, where the user can undo it. Each one also lands in the activity timeline as a `research.*` event marked "via" the agent, and open canvases refresh through the live socket. Accepting summaries and dragging cards stay with the user.

### Markdown dialect

`get_notes` and every note write use one markdown dialect, parsed by `fromNoteMarkdown` in `lib/note-content/note-markdown.ts` (the inverse of `toMarkdown`). Imports and legacy rows still go through plain `fromMarkdown`.

| Markdown | Becomes |
| --- | --- |
| `- [ ] text` / `- [x] text` (top level) | A task line backed by a `TaskItem` in the Inbox list. Rewriting a line keeps its task (same block id, else same text), and the checkbox sets the task's status. |
| `[[Label\|noteId]]`, `[[Label\|noteId#blockId]]` | A note link (and a `DocLink` backlink). New links to missing notes are refused. |
| `#tag` (starting with a letter) | A tag on that block. `#42` stays text. |
| `{{collection-view:viewId}}` on its own line | An embedded collection view. `get_notes` names each one under `embeds`. |
| `\#`, `\[`, `\]` | The literal character. `toMarkdown` escapes these itself. |

### Task tools

Tasks go through `server/tasks/task-store.ts`, the same store the Tasks page's router actions call. Every write publishes an `app:changed` tasks event, so an open Tasks page refreshes; the page skips its own echo for 2 seconds after a local save.

| Tool | Kind | Notes |
| --- | --- | --- |
| `tasks_list_lists` | read | Lists in rail order with open and total counts |
| `tasks_query` | read | Filter by list (id or name), status (open by default), due range, tag, source note, text, top level only |
| `tasks_create` | write | Inbox when no list is given; optional parent, due date, duration, tags, meta |
| `tasks_update` | write | Up to 50 tasks: status, description, due date, duration, tags, meta |
| `tasks_move` | write | To another list (with its subtasks), or to a new parent and position |
| `tasks_create_list` / `tasks_rename_list` | write | |

- A task that is a line in a note the user wrote (`textEditable: false`) keeps its text. Agents can still change its status, dates, tags, and place. This matches the note ownership rule.
- Deleting tasks and lists is left to the user; agents set `cancelled` instead.
- Agent task writes log `task.*` and `task_list.*` events, which show under Tasks in the activity timeline. The Tasks page's own edits are not logged.
- "Move to list" is in the task row menu too, so a task line from the Inbox can be filed anywhere.
- `tests/e2e/task-agent-sync.spec.ts` drives `/mcp` against a dev server. It needs `MCP_DEV_TOKEN`, so it skips in CI's production build.

A note belongs to ChatGPT when `Doc.originalSource = "chatgpt"`. User edits don't change that. Every call is logged as an `ActionEvent` with `actorType = chatgpt`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MCP_CONNECTOR_ENABLED` | `true` serves `/mcp` (and the OAuth routes). Anything else returns 404. This is the kill switch. |
| `MCP_TOKEN_SECRET` | HMAC secret for access tokens. Rotating it invalidates every issued access token. |
| `MCP_DEV_TOKEN` | Static bearer for local MCP Inspector runs. Ignored when `NODE_ENV=production`. |
| `PUBLIC_BASE_URL` | Origin used for note links in tool results. |

## Meaning-based search

When `OPENAI_API_KEY` is set and at least one embedding run exists (`/embeddings`), `search` also embeds the query with the newest run's model. It then ranks notes by cosine similarity against that run's doc vectors and merges the two lists with reciprocal rank fusion. Hits below a 0.25 similarity are dropped.

- Doc vectors are loaded into memory once and reloaded only when the run's embedding count or newest row changes.
- After any connector write, the app waits 10 seconds and then embeds up to 25 missing and 25 changed notes into the newest run, using the same pipeline as a manual run. A note ChatGPT just saved therefore becomes findable by meaning shortly after the save.
- Without a key or a run, or if the provider call fails, `search` falls back to keyword-only results.
- Evaluating it: ask ChatGPT (or call `search`) with about 10 real recall questions whose answer notes don't contain the query words. If `semantic`/`both` matches surface notes that keyword search misses, keep it. If not, the semantic branch can be removed without changing the tool contract.

## OAuth

ChatGPT connects with OAuth 2.1, served by the app itself for its single user:

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/oauth-protected-resource[/mcp]` | RFC 9728 metadata. Served from middleware, because the file router skips dot-folders. |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata: S256 PKCE, dynamic registration, `iss` on responses |
| `/oauth/register` | RFC 7591 dynamic client registration. Public clients only. Redirects must be HTTPS (loopback HTTP is allowed outside production). |
| `/oauth/authorize` | Requires the normal login (via `/login?next=…`), then shows a consent page |
| `/oauth/token` | `authorization_code` with PKCE, and rotating `refresh_token` |

- Access tokens are HS256 JWTs. They live for one hour, have `aud` set to `<origin>/mcp`, and carry the grant id. `/mcp` checks the signature, `iss`, `aud`, `exp`, and that the grant is not revoked, on every call.
- Codes and refresh tokens are stored only as SHA-256 hashes. Codes are single use. A refresh token that has already been rotated is refused.
- Scopes: `notes:read` covers the read tools and `notes:write` covers the write tools. `tools/list` adds a per-tool `securitySchemes` entry, which ChatGPT reads and the MCP SDK doesn't emit.
- To revoke one connection, set `OAuthGrant.revokedAt` (the admin UI comes later). To revoke everything, rotate `MCP_TOKEN_SECRET`.

## Local loop

1. Start the app against a disposable database (see `docs/audit-harness.md`) with `MCP_CONNECTOR_ENABLED=true` and `MCP_DEV_TOKEN=<random>`.
2. Run the smoke script, which uses the official MCP client:

   ```sh
   MCP_URL=http://127.0.0.1:<port>/mcp MCP_BEARER=<token> \
     node --experimental-strip-types scripts/mcp-smoke.ts --human-note <id of a user-written note>
   ```

3. Or explore interactively: `pnpm dlx @modelcontextprotocol/inspector` and connect to the same URL with the bearer header.

## Deploying and connecting ChatGPT

1. Set these on the production app, then deploy. The migrations run at container start.
   - `MCP_CONNECTOR_ENABLED=true`
   - `MCP_TOKEN_SECRET=$(openssl rand -hex 32)`
   - `PUBLIC_BASE_URL=https://<your notes origin>`. Tokens are issued for `<origin>/mcp`, so this must be the public HTTPS URL.
2. Check from outside:
   - `curl https://<origin>/.well-known/oauth-protected-resource/mcp` returns `resource: https://<origin>/mcp`.
   - `curl -i -X POST https://<origin>/mcp` returns `401` with a `WWW-Authenticate` header that has `resource_metadata`.
3. In ChatGPT, turn on developer mode (Settings → Apps & Connectors → Advanced). Create a connector with the URL `https://<origin>/mcp` and OAuth authentication. ChatGPT registers itself, then opens the Visual Notes login and consent page. Approve it.
4. Smoke test in a chat:
   - "Save a short plan about X to my notes." Expect a title, a path (possibly new), and a link that opens in the app.
   - In a new chat: "Find what we saved about X and add a next step." Expect `search` → `get_notes` → `update_note`/`append_to_note`, and a version row for the edit.
   - "Rename my note <title of a note you wrote>." Expect a refusal and an offer to create a linked note.
5. Watch the `[mcp]` and `[oauth]` log lines during the run.

Rollback: set `MCP_CONNECTOR_ENABLED=false`. `/mcp`, `/oauth/*`, and the metadata routes then return 404, and ChatGPT reports the connector unavailable. Notes that were already saved stay as normal notes.
