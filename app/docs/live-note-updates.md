# Live note updates

Open tabs refresh when a note is written somewhere else: an agent through [MCP](mcp-connector.md), another tab or device, the CLI ingest API, the extension, or a bulk action. No reload is needed, and unsaved typing is never replaced.

## How it works

1. **Publish.** A Prisma query extension on `Doc` (`src/server/note-change-extension.ts`, applied in `src/server/db.ts`) publishes a `notes:changed` event after every successful write. The event carries `{ id, updatedAt?, deleted? }[]`. Bulk writes send `null`, which means "refresh everything". The event never carries note content.
2. **Fan out.** `src/server/broadcast-bus.ts` delivers the event in-process. It keeps one listener set per thread on `globalThis`, because the Nitro WebSocket routes and the app bundle can load it separately. The `/ws/notes` route (`src/ws/notes.ts`) sends the event to each signed-in socket.
3. **Refresh.** `NoteLiveSyncProvider` (`src/features/live-sync/`) is mounted in the signed-in shell. It debounces events by 250 ms, then calls `revalidate(["docs-", "activity-"])`. After a reconnect, or when a tab returns from being hidden more than 5 minutes, it does one catch-up refresh.
4. **Open note.** `DocumentEditor` runs `checkRemote` when an event names its note, plus a 15s version poll as a fallback. An idle editor adopts the newer version with `applyRemoteContent`, a minimal diff that waits while the cursor is inside a changed block. A dirty draft is left alone: its next save sends the base version, and the server merges per block (`server/notes/note-write.ts`). A same-block conflict keeps the incoming save and stores the other version in Versions, with a toast. An event that arrives mid-save is checked once the save settles. The tab's own save echoing back is skipped by `updatedAt`. `useLiveNoteResource` keeps the note page and side panel headers current.

## Other areas

The same socket carries `app:changed` events for areas that are not notes: `research`, `tasks`, `collections`, `time-blocks`, `archive`, and `events`. Server code calls `publishAppChange(area, ids)` (`src/server/note-events.ts`) after a write, with the ids it touched (topic, task list, collection, …) (`null` for "everything"). The provider revalidates that area's query keys (`APP_LIVE_QUERY_KEYS` in `note-live-keys.ts`). A view that holds data in `createResource` instead calls `useAppChanges(area, reload, matches)`. A reconnect or a long-hidden tab catches up every area.

## Adding a note view

- Views that read through `query()` + `createAsync` under a `docs-*` or `activity-*` key refresh automatically.
- A view that holds a note in `createResource` needs `useLiveNoteResource` (or `useRemoteNoteChanges` for custom handling). Swap data with `mutate`, never `refetch`. A refetch suspends, and Suspense unmounts the editor beneath it.
- Read the server's copy with `fetchDocLatest`, not `fetchDoc`. A server-rendered note page leaves the `docs-get` query entry unread, so `fetchDoc` can return the stale SSR payload even after `revalidate`.
- Swap a resource only when the fields it shows changed. A new note object on every save steals the editor's focus.

## Operating it

- **Kill switch:** set `NOTE_LIVE_SYNC=false` on the server and restart. `/ws/notes` then closes each socket with code 4503, clients stop reconnecting, and tabs behave as they did before live updates. It's a runtime env var, so no rebuild is needed.
- **Reverse proxy:** forward WebSocket upgrades for `/ws/notes` (the `Upgrade` and `Connection` headers). Keep the idle timeout above 25 seconds; the server sends a ping every 25 seconds. With nginx, for example:

  ```nginx
  location /ws/ {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
  }
  ```

- **Commit timing:** `prisma.$transaction` runs in an `AsyncLocalStorage` scope (`deferNoteChanges`), so `Doc` writes inside it publish after the transaction commits, folded into one event. A rolled-back transaction publishes nothing. Block content writes always run in a transaction.
- **Auth:** the app middleware doesn't run for custom routers, so `/ws/notes` checks the magic-session cookie itself and rejects other upgrades with a 401.
- **Scale:** the bus runs in-process, which fits the single app container. Running several app instances would need Postgres `LISTEN/NOTIFY` behind `publishNoteChanges`.

## Checking it

- Unit: `cd app && pnpm test src/server/note-change-extension src/server/broadcast-bus src/server/note-events src/features/live-sync src/lib/socket-client`
- Socket and MCP smoke: run this against a local or disposable database.

  ```sh
  APP_URL=http://127.0.0.1:3141 AUTH_SECRET=<secret> MCP_BEARER=<MCP_DEV_TOKEN> \
    node --experimental-strip-types scripts/note-live-smoke.ts
  ```

  Set `NOTE_APPEND_ID=<chatgpt note id>` to append to a note you have open instead of creating one.

- Browser: `tests/e2e/live-note-updates.spec.ts` runs against a production build from the [audit harness](audit-harness.md).
- In the browser, `<html data-note-live="open">` shows the socket state, and console logs use the `[note-live]` prefix.
