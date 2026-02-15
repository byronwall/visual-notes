---
name: solidstart-data-async
description: Apply SolidStart SSR-safe data access and async boundaries. Use when implementing app data reads/writes, route resources, metadata, missing-resource handling, and hydration-safe async UI.
---

# SolidStart Data + Async Boundaries

Use this skill for client/server data flow and route-level async behavior.

## Rules

1. Reads: server `query()` + client `createAsync()`.
2. Writes: server actions.
3. Do not use raw `fetch()` in UI components for app data.
4. For detail routes, set route metadata from loaded data.
   - Set `<Title>` and OG title/description from the resource.
5. Missing resources must return true 404 semantics.
   - Use `HttpStatusCode` with a clear recovery CTA (`Go home` or equivalent).
6. SSR-sensitive overlays/selects must keep server and first client DOM identical.
   - If needed, render deterministic fallback until mount, then enable interactive overlay.
   - Avoid locale-dependent initial labels in SSR output when they can differ by environment.

## Async UX Expectations

- Wrap resource UI in `Suspense` fallback.
- Prefer stable-height result panes (`overflow: auto`) for streaming/dynamic content.
- Prefer handling empty states inside resolved content instead of resource-level branch forks.

## Verification Checklist

- No UI-level app-data `fetch()`.
- `query/createAsync` and server actions used for data operations.
- Detail routes set title/OG metadata.
- Missing resources return HTTP 404 and user-facing recovery action.
- SSR/client first render structure matches in async overlay controls.
