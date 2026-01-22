# Client-Server Comms Playbook (SolidStart)

Goal: Replace client-side fetch calls to internal API routes with SolidStart
query()/createAsync() for reads and action() for writes. This keeps data loading
SSR-friendly and avoids ad-hoc fetch in UI components.

## When to convert

- UI code calls fetch()/apiFetch() for app data.
- A route under app/src/routes/api is only used by the app itself.
- The endpoint is a read (query) or write (action) and does not need to be
  exposed as a public HTTP API.

## Conversion steps (high level)

1. Identify the API route and the client caller(s).
2. Move the server logic into a shared module (not under routes/).
3. Expose:
   - query() for reads
   - action() for writes
4. Update UI code to call the query/action (no fetch in the component).
5. Remove the now-unused API route (if nothing else depends on it).
6. Verify behavior (type-check/build; manual click-through if needed).

## Routes to convert (current app usage)

None. All app callers now use query()/action().

Notes

- HTTP routes still kept for external clients: /api/docs and /api/docs/inventory.
- /api/auth/[...solidauth] and /api/auth/register remain as HTTP routes.

## Completed conversions (app callers)

Queries (GET)

- /api/magic-session
- /api/embeddings/runs
- /api/embeddings/runs/[id]
- /api/embeddings/runs/docs/[docId]/sections
- /api/umap/runs
- /api/umap/points
- /api/umap/runs/[id]
- /api/docs
- /api/docs/[id]
- /api/docs/search
- /api/docs/sources
- /api/docs/paths
- /api/docs/meta/keys
- /api/docs/meta/values
- /api/ai/runs
- /api/ai/runs/[id]
- /api/ai/models
- /api/ai/chat/threads
- /api/ai/chat/threads/[id]
- /api/prompts
- /api/prompts/[id]

Actions (POST/PUT/PATCH/DELETE)

- /api/magic-login
- /api/logout
- /api/embeddings/runs (POST)
- /api/embeddings/runs/[id] (POST/PATCH/DELETE)
- /api/umap/runs (POST)
- /api/umap/runs/[id] (PATCH/DELETE)
- /api/docs (POST/DELETE)
- /api/docs/[id] (PUT/DELETE)
- /api/docs/source (POST/DELETE)
- /api/docs/path-round (POST)
- /api/docs/bulk-delete (POST)
- /api/docs/bulk-meta (POST)
- /api/docs/scan-relative-images (POST)
- /api/ai/runPrompt (POST)
- /api/ai/promptDesigner (POST)
- /api/ai/chat/threads (POST)
- /api/ai/chat/threads/[id] (PATCH)
- /api/ai/chat/threads/[id]/messages (POST)
- /api/ai/chat/messages/[id] (PATCH/DELETE)
- /api/prompts (POST)
- /api/prompts/[id] (PUT/DELETE)
- /api/prompts/[id]/activate (POST)
- /api/prompts/[id]/versions (POST)
- /api/prompts/[id]/revise (POST)
- /api/docs/cleanup-titles (POST) -- route removed; now query/action only

Notes

- Some HTTP routes remain to support external clients (e.g. CLI ingest/inventory).

## Detailed checklist

- Server module
  - Create a file near the feature, e.g. app/src/features/<feature>/data/\*.ts
  - Import prisma (or other server deps) directly in the module.
- Export named functions using query() and action().
  - In action() bodies, include "use server" as the first statement.
  - Keep types in the same file.
- UI module
  - Read:
    - Use createAsync(() => myQuery(args)) when data is shown in the UI.
    - For on-demand reads, it is OK to call the query directly and await it.
  - Write:
    - Use useAction(myAction) and call the returned function.
  - Remove any fetch()/apiFetch() usage tied to internal routes.
- Route cleanup
  - Delete the old app/src/routes/api/... file once no callers remain.
  - If an external client still depends on the HTTP route, keep the route and
    consider calling the shared query/action from it.

## Example pattern

- Read
  - server module: export const getThing = query(async (id: string) => { ... }, "thing");
  - UI module: const thing = createAsync(() => getThing(id()));
- Write
  - server module: export const saveThing = action(async (payload) => { "use server"; ... }, "save-thing");
  - UI module: const runSave = useAction(saveThing); await runSave(payload);

## Learnings from this conversion

- Query functions (from `query()`) work best with `createAsync()` in UI, not `createResource()`.
- When using `createAsync()` for list data, re-fetch with `revalidate(query.keyFor(args))` instead of `refetch`.
- Remove AbortSignal plumbing tied to `fetch` (e.g., `useAbortableFetch`) when calls move to `query()` since queries manage their own caching.
- Prefer small, scoped data modules (types, queries, actions) to keep files <200 LOC and make conversions easier.
- Keep server-side types local to the module and export only the client-facing types.

## Common pitfalls

- Using fetch() in UI for app data (prefer query/action).
- Putting shared logic under app/src/routes/ (keep routes for routing only).
- Forgetting to remove stale API routes after migration.
- Using props destructuring in Solid components (breaks reactivity).

## Notes

- For reads that are part of the page UI, prefer createAsync() so SSR can
  preload data and keep the loading state consistent.
- For mutations, action() provides the correct client-server wiring without
  manual fetch.
