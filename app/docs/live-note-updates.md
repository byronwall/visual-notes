# Live note updates

Open tabs refresh when a note is written somewhere else: ChatGPT through MCP, another tab or device, the CLI ingest API, the extension, or a bulk action. No reload is needed, and unsaved typing is never replaced.

## How it works

1. **Publish.** A Prisma query extension on `Doc` (`src/server/note-change-extension.ts`, applied in `src/server/db.ts`) publishes a `notes:changed` event after every successful write. The event carries `{ id, updatedAt?, deleted? }[]`. Bulk writes send `null`, which means "refresh everything". The event never carries note content.
2. **Fan out.** `src/server/broadcast-bus.ts` delivers the event in-process. It keeps one listener set per thread on `globalThis`, because vinxi loads each router's modules separately. The `/ws/notes` router (`src/ws/notes.ts`) sends the event to each signed-in socket.
3. **Refresh.** `NoteLiveSyncProvider` (`src/features/live-sync/`) is mounted in the signed-in shell. It debounces events by 250 ms, then calls `revalidate(["docs-", "activity-"])`. After a reconnect, or when a tab returns from being hidden more than 5 minutes, it does one catch-up refresh.
4. **Open note.** `createEditorRemoteSync` decides what the editor does: a clean note takes the new content in place, a dirty one shows a "changed elsewhere" notice with Reload or Keep mine, a change that arrives during a save waits for the save to finish, and the tab's own save echoing back is ignored by `updatedAt`. `useLiveNoteResource` keeps the note page and side panel headers current.

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
