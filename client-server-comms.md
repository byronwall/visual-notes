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

## Detailed checklist

- Server module
  - Create a file near the feature, e.g. app/src/features/<feature>/data/\*.ts
  - Import prisma (or other server deps) directly in the module.
  - Export named functions using query() and action().
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
  - server module: export const saveThing = action(async (payload) => { ... }, "save-thing");
  - UI module: const runSave = useAction(saveThing); await runSave(payload);

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
