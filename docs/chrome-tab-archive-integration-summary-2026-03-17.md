# Chrome Tab Archive Integration Summary (2026-03-17)

## 1) Scope and Context

- Request: add a Chrome extension integration that can archive all tabs in the current Chrome window, support targeted capture with notes and screenshots, persist raw HTML to disk, and expose a first-class archive browsing UI inside Visual Notes.
- Implemented scope:
  - Dedicated archive data model and migration.
  - Disk-backed HTML persistence under `app/data/page-html` semantics.
  - Token-protected ingest APIs for extension-driven bulk and targeted capture.
  - New archive browse route with table filters and drawer detail view.
  - Sidebar navigation entry.
  - A loadable Chrome MV3 extension package under `extension/`.
- Main files added or changed:
  - Data model:
    - `app/prisma/schema.prisma`
    - `app/prisma/migrations/20260317090000_add_archive_pages/migration.sql`
  - Server helpers and services:
    - `app/src/server/lib/archive/auth.ts`
    - `app/src/server/lib/archive/html-storage.ts`
    - `app/src/server/lib/archive/url.ts`
    - `app/src/server/lib/archive/types.ts`
    - `app/src/services/archive/archive.ingest.ts`
    - `app/src/services/archive/archive.queries.ts`
    - `app/src/services/archive/archive.service.ts`
  - API routes:
    - `app/src/routes/api/archive/bulk-capture.ts`
    - `app/src/routes/api/archive/targeted-capture.ts`
    - `app/src/routes/api/archive/lookup.ts`
    - `app/src/routes/api/archive/items/index.ts`
    - `app/src/routes/api/archive/items/[id].ts`
  - UI:
    - `app/src/routes/archive.tsx`
    - `app/src/components/archive/ArchiveDetailDrawer.tsx`
    - `app/src/components/sidebar/AppSidebarNav.tsx`
    - `app/src/middleware.ts`
    - `app/src/env/schema.ts`
  - Extension package:
    - `extension/manifest.json`
    - `extension/background.js`
    - `extension/api-client.js`
    - `extension/popup.html`
    - `extension/popup.js`
    - `extension/content-targeted.js`
    - `extension/screenshot.js`
- Constraints that shaped the implementation:
  - Existing `Doc` records already serve editable notes, so archive data needed to stay separate to avoid polluting the current notes model and index behaviors.
  - The repo already had disk-backed image persistence for inline images; screenshot storage was aligned to that pipeline instead of inventing another binary storage path.
  - App middleware blocks unauthenticated `/api/*` routes by default, so extension ingest needed an explicit token path.
  - The initial browsing surface had to stay simple: table + filters + drawer, not an infinite canvas.

## 2) Major Changes Delivered

### Archive data model

- Added `ArchivedPage` as the canonical per-URL record.
  - Stores normalized URL, original URL, title, hostname, current group, latest meta, and last-captured time.
- Added `ArchivedPageSnapshot` as append-only capture history.
  - Stores capture mode (`bulk` or `targeted`), group name, HTML hash/path, text snippet, meta, and raw extension payload.
- Added `ArchivedPageNote` for targeted annotations.
  - Stores plain-text note content, screenshot URLs, optional source context, and an optional link back to the snapshot created during that targeted capture.

### HTML and image persistence

- Added archive HTML storage helper in `app/src/server/lib/archive/html-storage.ts`.
- Raw page HTML is written content-addressably:
  - Directory: `data/page-html`
  - Filename: `<sha256>.html`
  - DB stores the relative archive path, not the entire HTML payload.
- Targeted screenshots reuse the existing doc-image storage pipeline:
  - `persistDataImage(...)`
  - Public URLs use the existing `/api/doc-images/<hash.ext>` route shape.

### Ingest and lookup APIs

- Added `POST /api/archive/bulk-capture`
  - Accepts current-window batch capture payload.
  - Upserts canonical pages by normalized URL.
  - Creates a snapshot row per captured tab.
- Added `POST /api/archive/targeted-capture`
  - Accepts page capture + note text + optional screenshot data URL + selection metadata.
  - Appends notes to an existing page if the normalized URL already exists.
- Added `GET /api/archive/lookup?url=...`
  - Lets the extension check whether a page already exists before targeted logging.
- Added `GET /api/archive/items`
  - Returns the archive table list with group, hostname, and time filtering.
- Added `GET /api/archive/items/:id`
  - Returns drawer detail payload with notes, images, snapshot history, and a server-generated HTML snippet.

### Auth path for the extension

- Added `ARCHIVE_INGEST_TOKEN` env support in `app/src/env/schema.ts`.
- Added `app/src/server/lib/archive/auth.ts` with bearer-token validation helpers.
- Updated `app/src/middleware.ts` so archive ingest/lookup routes can authenticate with the ingest token instead of the app’s cookie session.
- Existing app auth behavior remains unchanged for the normal UI.

### App UI

- Added a new top-level route: `/archive`
  - Title
  - Group filter
  - Hostname filter
  - Captured-from / captured-to filters
  - Table columns:
    - Title
    - Host
    - Group
    - Last captured
    - Notes
    - Snapshots
- Added a detail drawer:
  - Current title and URL
  - Latest HTML snippet
  - Captured meta summary
  - Notes in reverse chronological order
  - Screenshot thumbnails
  - Snapshot history list
- Added `Archive` to the main sidebar nav in `app/src/components/sidebar/AppSidebarNav.tsx`.

### Chrome extension package

- Added a standalone MV3 extension under `extension/`.
- Popup supports:
  - Local server base URL config
  - Ingest token config
  - Bulk log for current window
  - Targeted log for current tab
  - Selection mode choice: region or DOM node
  - Current-tab existence lookup display
- Background worker supports:
  - `chrome.tabs.query({ currentWindow: true })`
  - Runtime page extraction via `chrome.scripting.executeScript`
  - Targeted capture flow with overlay injection + screenshot crop
  - POSTing captures to the app’s archive APIs
- Content script overlay supports:
  - Element click selection
  - Drag-region selection
  - Returned selector/text/rect metadata for note context

## 3) Design Decisions and Tradeoffs

- Decision: separate archive domain instead of extending `Doc`.
  - Alternative: reuse `Doc` with archive metadata stuffed into `meta`.
  - Why chosen: `Doc` currently represents editable note content and is already wired into search, preview, path, activity, and editor flows.
  - Tradeoff: more schema and service code, but lower risk of unintended regressions in existing note behaviors.

- Decision: canonical `ArchivedPage` plus append-only `ArchivedPageSnapshot`.
  - Alternative: overwrite a single page record on every recapture.
  - Why chosen: bulk recaptures should preserve history rather than destroy prior page states.
  - Tradeoff: more rows and slightly more query complexity.

- Decision: HTML on disk, metadata in Postgres.
  - Alternative: store raw HTML in a `TEXT` column for every snapshot.
  - Why chosen: page DOM dumps can become large quickly, and raw HTML is not the primary browse payload.
  - Tradeoff: snippet generation must re-read disk data for detail views, and HTML files now become part of operational storage.

- Decision: reuse existing image pipeline for targeted screenshots.
  - Alternative: create separate archive-image storage.
  - Why chosen: the app already has content-hash image storage, URL serving, MIME handling, and dedupe patterns.
  - Tradeoff: archive screenshots and note images share the same bucket/namespace.

- Decision: dedicated bearer ingest token for extension APIs.
  - Alternative: rely on the app’s existing magic-auth cookie session.
  - Why chosen: simpler extension configuration, less ambiguity around extension-origin cookie behavior, and clearer separation between local ingest access and interactive UI auth.
  - Tradeoff: one more env var plus manual extension configuration.

- Decision: buildless extension package.
  - Alternative: set up a separate Vite or TS build for the extension.
  - Why chosen: fastest path to a loadable unpacked extension with minimal tooling overhead.
  - Tradeoff: plain JS only, less compile-time safety, and more manual runtime validation.

## 4) Problems Encountered and Resolutions

- Problem: archive ingest routes would still be blocked by middleware before token checks.
  - Symptom: even valid bearer-token requests would be rejected because middleware globally blocks unauthenticated `/api/*` traffic.
  - Resolution: updated `app/src/middleware.ts` so the archive ingest and lookup routes accept a valid archive ingest token without requiring the app cookie.
  - Preventative action: whenever new machine-to-machine API routes are added, check middleware routing early instead of only route-level auth.

- Problem: first-pass UI typing issues in the new archive route and drawer.
  - Symptom: `pnpm type-check` surfaced Solid keyed `Show` misuse, search-param typing issues, and UI prop mismatches.
  - Resolution: normalized search param reads, fixed access patterns inside keyed `Show`, and aligned UI prop names with existing styled-system wrappers.
  - Preventative action: run `pnpm type-check` immediately after introducing a new route + component pair, before broadening implementation.

- Problem: Prisma migration diff could not be generated in-place from the migrations directory without a shadow DB.
  - Symptom: `pnpm prisma migrate diff --from-migrations ...` failed because `--shadow-database-url` was required.
  - Resolution: added a manual SQL migration file for the new archive schema and regenerated the Prisma client from the updated schema.
  - Preventative action: if a sandboxed or non-DB environment blocks schema diff tooling, write the migration file directly and verify through generated client + type-check.

- Problem: screenshot cropping helper originally assumed document-only blob reading behavior.
  - Symptom: service-worker-compatible screenshot processing needed a safer conversion path.
  - Resolution: updated `extension/screenshot.js` to convert blobs to data URLs via `arrayBuffer()` + base64 encoding instead of relying on `FileReader`.
  - Preventative action: keep extension-side helpers compatible with worker contexts unless they are explicitly popup-only or content-script-only.

## 5) Verification and Validation

- Commands run:
  - `cd app && pnpm prisma generate`
  - `cd app && pnpm type-check`
  - `cd app && pnpm lint`
  - `cd app && pnpm test -- src/server/lib/archive/url.test.ts`
- Results:
  - Prisma client generation passed.
  - Type-check passed.
  - Lint passed with existing repo warnings only; no new errors were introduced.
  - Archive helper test passed:
    - URL normalization strips fragments while preserving query params.
    - HTML snippet generation reduces HTML into a short readable preview string.
- What was not run:
  - No live database migration apply was run against a real database.
  - No end-to-end browser run of the extension against the app was executed in this pass.
  - No Playwright validation of the new `/archive` route was run.

## 6) Process Improvements

- Improvement: backend-first sequencing worked well for cross-surface features.
  - Pain: extension, server APIs, schema, and UI all depended on each other.
  - Change: build data model and APIs first, then UI, then extension package.
  - Benefit: the extension and UI could target stable routes and payload shapes instead of stubs.
  - Suggested place to encode: repo workflow notes for multi-surface features.

- Improvement: type-check as the main integration gate before lint.
  - Pain: first-pass UI/route wiring had multiple small Solid typing mistakes.
  - Change: run `pnpm type-check` immediately after feature assembly, then use lint only as a secondary guard.
  - Benefit: faster iteration on real integration errors.
  - Suggested place to encode: AGENTS verification section for new routes/services.

- Improvement: middleware review should be an explicit step when adding non-UI APIs.
  - Pain: route-level auth alone was not enough because global middleware intercepted requests first.
  - Change: check middleware reachability any time a new `/api/*` endpoint is meant for automation or external clients.
  - Benefit: fewer false assumptions about route accessibility.
  - Suggested place to encode: AGENTS auth/API checklist.

## 7) Agent/Skill Improvements

- Improvement candidate: add a reusable “external-client API checklist” skill or AGENTS note.
  - Current pain: extension/machine-client work requires checking middleware, auth headers, CORS assumptions, and payload stability across multiple layers.
  - Proposed change: add a short checklist covering:
    - middleware reachability
    - route-level auth
    - env vars
    - payload schemas
    - manual client bootstrap instructions
  - Expected benefit: less integration churn on browser-extension and CLI-ingest work.
  - Suggested owner/place: `AGENTS.md` or a new repo-local skill.

- Improvement candidate: add an extension-specific skill.
  - Current pain: Chrome extension work spans MV3 restrictions, worker-vs-content-script contexts, permissions, and limited runtime APIs.
  - Proposed change: create a local skill documenting:
    - MV3 architecture patterns
    - injectable vs restricted page rules
    - storage/config conventions
    - screenshot and selection patterns
    - localhost ingest recommendations
  - Expected benefit: faster follow-on work when the extension evolves beyond the initial popup + capture flow.
  - Suggested owner/place: `.agents/skills/`.

- Improvement candidate: note Prisma fallback strategy for sandboxed planning/implementation.
  - Current pain: migration-diff tooling can depend on a shadow DB that is not always available.
  - Proposed change: add a repo instruction describing when manual migration SQL is acceptable and what verification should accompany it.
  - Expected benefit: clearer decisions during schema work in constrained environments.
  - Suggested owner/place: `AGENTS.md` Prisma section.

## 8) Follow-ups and Open Risks

- Follow-ups:
  - Add real extension packaging/build tooling if this moves beyond unpacked local use.
  - Add end-to-end validation for:
    - bulk capture flow
    - targeted capture flow
    - archive table rendering
    - drawer detail behavior
  - Add richer URL normalization policy if needed:
    - fragment stripping is implemented
    - more advanced query-param canonicalization is not yet implemented
  - Add pagination and heavier filtering once archive volume grows.
  - Add an HTML viewer or raw-html download route if LLM or inspection workflows need access to stored source beyond snippets.
  - Consider a richer note editor for targeted captures if plain text becomes limiting.

- Open risks:
  - The manual migration file has not been applied to a live database in this implementation pass.
  - The extension currently assumes the local app origin is reachable from the browser and that the configured ingest token matches server env.
  - Some tabs will always be skipped by Chrome for security reasons:
    - `chrome://`
    - Web Store and other restricted surfaces
    - extension pages
    - tabs without granted access
  - Region screenshot capture is visible-viewport only; no stitched full-page capture exists yet.
  - The archive drawer currently shows a plain text snippet derived from stored HTML, not a structured preview of the archived DOM.

## How the Feature Works End to End

### Bulk archive flow

1. User opens the extension popup.
2. User enters a group name and clicks `Bulk log tabs`.
3. Background worker queries tabs in the current window with `chrome.tabs.query({ currentWindow: true })`.
4. Each injectable tab is processed with `chrome.scripting.executeScript(...)`.
5. The extractor returns:
   - URL
   - title
   - OG/Twitter/basic meta
   - text snippet
   - `document.documentElement.outerHTML`
6. The extension sends a batch payload to `POST /api/archive/bulk-capture`.
7. Server:
   - normalizes URL
   - upserts `ArchivedPage`
   - writes HTML to `data/page-html/<sha256>.html`
   - creates `ArchivedPageSnapshot`
8. App UI shows the result under `/archive`.

### Targeted archive flow

1. User opens the extension popup on the active tab.
2. Extension looks up the current URL via `GET /api/archive/lookup?url=...`.
3. User enters note text and chooses `Brush region` or `Pick DOM node`.
4. Background worker injects `content-targeted.js`.
5. Content script returns a selection payload:
   - selector and text for node mode
   - crop rectangle for region mode
6. Background worker captures the visible tab screenshot.
7. Screenshot is cropped to the returned region when applicable.
8. Extension sends the targeted payload to `POST /api/archive/targeted-capture`.
9. Server:
   - upserts canonical page by normalized URL
   - stores HTML snapshot
   - stores screenshot via the existing doc-image pipeline
   - creates `ArchivedPageNote`
10. The note and screenshot appear in the archive item drawer.

### Archive browse flow

1. User opens `/archive`.
2. Route reads data through `fetchArchivedPages(...)`.
3. Table renders archive items with counts and last-captured timestamps.
4. Clicking a row opens `ArchiveDetailDrawer`.
5. Drawer reads detail through `fetchArchivedPageDetail(...)`.
6. Server rehydrates a snippet from the latest stored HTML file and returns:
   - title
   - URL
   - latest meta
   - notes
   - screenshots
   - recent snapshots

## Configuration Notes

- Required server env:
  - `ARCHIVE_INGEST_TOKEN`
- Optional future env:
  - `ARCHIVE_HTML_STORAGE_DIR` is supported through the storage helper even though it is not yet part of validated env schema.
- Extension local config:
  - server base URL, default `http://127.0.0.1:3000`
  - ingest token

## None Sections

- Agent/system prompt changes already applied in code: None.
  - Reason: this pass only produced implementation docs; no prompt files or global system instructions were modified.
