# Explorer Feature Work Summary (2026-03-20)

## Scope And Context

This work expanded and refined the Explorer feature across four connected areas:

- Explorer list-row previews and image viewing
- Explorer admin surfaces for HTML snapshot inspection
- Extension download and URL-ingest normalization
- Group canvas support for freeform notes and pasted images

The primary goal was to make Explorer feel less like a passive archive and more like an active research workspace. The main user requests were:

- richer image stacks in the main Explorer grid/list
- a better image modal with multi-image navigation
- admin tools that expose saved HTML snapshot size and content more clearly
- a working temporary Chrome extension download flow
- a less archive-like Explorer icon
- support for adding freeform note/image content directly onto archive group canvases

## Major Changes Delivered

### 1. Explorer list previews now distinguish OG-only vs user-image cases

Files:

- `app/src/components/archive/ArchivePreviewStack.tsx`
- `app/src/routes/archive/index.tsx`
- `app/src/services/archive/archive.queries.ts`
- `app/src/services/archive/archive.types.ts`

Behavior changes:

- If an Explorer item only has a social/OG image, the row shows a single thumbnail.
- If an item has user-captured images, the row shows a messy stacked preview instead of a single OG image.
- Hovering the user-image stack expands the first visible images outward.
- Clicking an image stack opens the image modal/carousel instead of opening the row details drawer.
- The preview column was given additional overflow headroom and left gutter space so expanded stacks can escape their cell boundaries and overhang neighboring borders.

Data changes:

- `ArchivedPageListItem` now exposes `socialPreviewImageUrl` and `userImageUrls` instead of the previous generic preview fields.
- Query logic now extracts user-note images separately from OG/social image metadata so the UI can choose the right presentation.

### 2. Image modal was upgraded from single-image preview to multi-image viewer

Files:

- `app/src/components/editor/ui/ImagePreviewModal.tsx`
- `app/src/components/editor/ui/imagePreviewService.tsx`

Behavior changes:

- The image preview service now supports opening a scoped image carousel with an initial image index.
- The modal now supports:
  - multi-image browsing
  - explicit thumbnail selection
  - previous/next controls
  - keyboard navigation
  - vertical thumbnail rail in a dedicated side column
  - left-side large image stage
  - copy/download/zoom controls

Interaction specifics:

- Clicking a row preview opens the modal at the intended image index.
- `ArrowLeft` and `ArrowUp` move backward.
- `ArrowRight` and `ArrowDown` move forward.
- The `1 / N` counter was moved into the top-right controls row next to `Prev` and `Next`.
- Switching images resets pan/zoom and refits the selected image so the newly chosen image is immediately visible.

Layout changes:

- The modal was redesigned into a two-column viewer:
  - left: large zoomable image stage
  - right: controls plus a vertical thumbnail rail

### 3. Group canvases now support freeform note and image nodes

Files:

- `app/prisma/schema.prisma`
- `app/prisma/migrations/20260320024127_add_archive_feature_nodes/migration.sql`
- `app/src/services/archive/archive.actions.ts`
- `app/src/services/archive/archive.queries.ts`
- `app/src/services/archive/archive.types.ts`
- `app/src/services/archive/archive.service.ts`
- `app/src/components/archive/ArchiveGroupCanvas.tsx`
- `app/src/components/archive/ArchiveCanvasFreeformCard.tsx`
- `app/src/components/archive/ArchiveCanvasNoteModal.tsx`

Schema/data-model changes:

- Added `ArchivedCanvasNodeKind` enum with `note` and `image`.
- Added `ArchivedCanvasNode` model with:
  - `groupName`
  - `kind`
  - `contentHtml`
  - `imageUrl`
  - `canvasX`
  - `canvasY`
  - timestamps

Canvas behavior changes:

- Group canvases now merge two entity types into one surface:
  - archived page cards
  - freeform canvas nodes
- Added an `Add note` action in the canvas toolbar.
- Added note editing via a dedicated modal using the existing TipTap editor stack, but not backed by a standalone doc.
- Added support for pasting an image directly onto the canvas:
  - image clipboard data is converted to a persisted doc-image asset
  - a new image node is created at the canvas viewport center
- Added delete and move support for freeform nodes.
- Grid arrangement and persisted canvas layout now work for both page cards and freeform nodes.

Design intent:

- Archived URLs remain first-class Explorer items.
- Freeform note/image content is scoped to a group canvas instead of overloading `ArchivedPage` itself.
- This avoids turning every archive record into a hybrid content object with unrelated storage concerns.

### 4. Explorer admin is now split into a real admin home and a stronger snapshot review surface

Files:

- `app/src/routes/admin/index.tsx`
- `app/src/routes/admin/archive/index.tsx`
- `app/src/routes/admin/archive/snapshots/[id].tsx`
- `app/src/components/sidebar/AppSidebarFooter.tsx`

Behavior changes:

- Added a dedicated `/admin` landing page instead of jumping straight into Explorer admin.
- Admin footer navigation now targets `/admin`.
- Explorer admin now includes:
  - summary cards
  - clearer HTML size visibility
  - stored file path visibility
  - snippet column visibility
  - explicit review/download actions
- Snapshot detail pages now include:
  - back link to admin home
  - stored file path
  - truncated hash
  - stored snippet context

Intent:

- The original admin page was too compressed and overflow-prone for snapshot inspection.
- The new structure makes “which admin tool should I use?” explicit.

### 5. Extension download route was fixed

Files:

- `app/src/routes/api/archive/extension-package.ts`

Behavior changes:

- The extension package route now resolves the extension directory from either:
  - `process.cwd()/extension`
  - `process.cwd()/../extension`
- This fixes the broken path assumption that was causing the download route to fail in some runtime contexts.
- If no extension directory is found, the route now returns the HTML landing page instead of failing deeper in the shell call path.

### 6. Sidebar Explorer icon now conveys exploration rather than storage/archive

Files:

- `app/src/components/sidebar/AppSidebarNav.tsx`

Behavior changes:

- Replaced the archive-like sidebar icon with `CompassIcon`.

### 7. URL normalization remains aligned with note-cleanup behavior

Files:

- `app/src/server/lib/archive/url.ts`
- `app/src/services/archive/archive.ingest.ts`

Result:

- No new code change was required here.
- Verification during implementation confirmed archive ingest already normalizes URLs through `normalizeArchivedPageUrl`, which strips `utm_*` parameters and removes hashes before persistence.

## Design Decisions And Tradeoffs

### Freeform canvas content was modeled as a new table instead of extending `ArchivedPageNote`

Decision:

- Introduce `ArchivedCanvasNode` instead of forcing freeform note/image canvas content into page-bound notes.

Why:

- Page notes are inherently tied to archived pages and snapshots.
- Group-canvas stray content is group-scoped, not page-scoped.
- Reusing page notes would have created confusing semantics around:
  - ownership
  - lifecycle
  - visibility in drawers
  - placement persistence

Tradeoff:

- More code and schema complexity now.
- Cleaner long-term separation of concerns between captured content and freeform canvas content.

### Explorer image interaction favors reliable whole-stack click over per-overlapped image hit-testing

Decision:

- Keep the hover-expanded stack visual, but route stack clicks into the scoped modal/carousel in a stable way.

Why:

- True overlapping per-image click regions became unreliable when images physically intersected.
- A previous attempt with overlay-only targeting regressed the click-to-open behavior entirely.
- The current balance favors reliable modal opening and hover affordance over complex hit-map logic.

Tradeoff:

- The UI visually suggests individual image pieces, but the effective open behavior is stack-level for reliability.
- This is acceptable for now because the modal itself exposes exact image selection via thumbnails.

### Modal layout was reworked instead of incrementally tweaking the footer-strip version

Decision:

- Replace the bottom-strip carousel layout with a dedicated right control rail and vertical thumbnails.

Why:

- The footer-strip layout made image selection feel secondary.
- The new two-column layout gives images, controls, and navigation each a stable region.

Tradeoff:

- More modal code and responsive layout complexity.
- Better discoverability and much stronger image navigation UX.

### Admin landing page was added instead of making `/admin/archive` absorb all admin tools

Decision:

- Create a top-level admin chooser page.

Why:

- User feedback indicated the archive admin page was already trying to do too much.
- Snapshot review and maintenance tooling belong in the same general admin area but should not compete for space.

Tradeoff:

- One extra click to reach a specific admin page.
- Much lower cognitive load and better future extensibility.

## Problems Encountered And Resolutions

### 1. `prisma migrate dev` failed with a schema engine error

Observed:

- Running `pnpm prisma migrate dev --name add_archive_canvas_nodes` in `app/` failed with:
  - `Error: Schema engine error`

Resolution:

- Verified the intended schema diff manually.
- Confirmed the checked-in migration contents under:
  - `app/prisma/migrations/20260320024127_add_archive_feature_nodes/migration.sql`
- Regenerated Prisma client with:
  - `pnpm prisma generate`

Impact:

- Migration generation was not fully reliable in the local environment during this run.
- The repo still ended with a concrete migration file matching the schema change.

### 2. Hover-expanded preview images were clipped by the table shell

Observed:

- The preview stack could expand visually, but the table container and cells clipped the hover overhang aggressively, especially on the left edge.

Resolution:

- Changed the Explorer table wrapper to allow visible overflow.
- Added explicit overflow overrides and z-index handling for the preview cell.
- Added left padding/gutter on the preview column so the first stack has room to escape.

Files:

- `app/src/routes/archive/index.tsx`
- `app/src/components/archive/ArchivePreviewStack.tsx`

### 3. A fix for image overlap broke image-opening interaction

Observed:

- Replacing individual image hit areas with a single overlay fixed click-target conflicts, but it also removed the feel of clicking an actual image and caused a regression in image-open behavior expectations.

Resolution:

- Restored explicit image interaction semantics.
- Added row click suppression on preview interactions so clicking previews does not open row details.
- Added stronger hover affordance on the image stack.
- Relied on the modal thumbnail rail for precise image selection once the modal is open.

### 4. Modal image switching initially kept stale zoom/pan state

Observed:

- Selecting a new image in the modal could leave the previous image’s zoom/pan state applied.

Resolution:

- Reset pan/zoom/natural size and trigger refit whenever `currentSrc()` changes.

File:

- `app/src/components/editor/ui/ImagePreviewModal.tsx`

### 5. Browser verification required local auth before reaching Explorer/admin routes

Observed:

- Navigating to `/archive` in Playwright initially redirected to `/login`.

Resolution:

- Read local auth config from `app/.env`.
- Signed in using the development password.
- Continued browser verification against authenticated routes.

## Verification And Validation

Commands run:

- `cd app && pnpm type-check`
- `cd app && pnpm lint`
- `cd app && pnpm prisma generate`
- Attempted: `cd app && pnpm prisma migrate dev --name add_archive_canvas_nodes`

Results:

- `pnpm type-check`: passed after the implemented changes
- `pnpm lint`: passed with existing repo-wide warnings; no new lint errors remained
- `pnpm prisma generate`: passed
- `pnpm prisma migrate dev`: failed due to Prisma schema engine error in local environment

Manual/browser validation performed:

- Signed into the app through `/login`
- Reviewed `/archive`
- Reviewed hover behavior and clipping of preview stacks
- Iterated on preview stack click behavior vs row-detail opening
- Reviewed `/admin`
- Reviewed `/admin/archive`
- Reviewed `/admin/archive/snapshots/[id]`
- Reviewed the extension download landing route

Validated behaviors:

- Explorer previews render OG-only and user-image cases differently
- Hover-expanded stacks can overhang the preview column instead of being fully clipped
- Clicking preview images does not trigger row detail opening
- Modal layout now supports side-column thumbnails and keyboard navigation
- Admin home exists and routes to archive admin and migrations
- Explorer admin shows HTML size, file path, snippet, and review/download actions
- Extension package route resolves the actual extension folder more defensively

What was not fully validated:

- End-to-end creation/editing/deletion of freeform canvas note/image nodes against a live database after applying the migration
  - Reason: local migration generation failed and browser time was spent on the image/admin interaction pass
- Full cross-browser interaction behavior
  - Reason: this pass was done in the local Playwright environment only

## Process Improvements

### 1. Separate behavior reads from data-model reads earlier in multi-surface feature work

Problem:

- This task mixed UI polish, admin tooling, API fixes, and schema work.
- Early progress was best once the work was explicitly split by surface.

Proposed change:

- For multi-surface feature requests, establish a short explicit work split early:
  - UI interactions
  - admin/reporting surfaces
  - API/server behavior
  - schema/data model

Expected benefit:

- Less context churn
- Easier verification sequencing

Suggested place to encode:

- AGENTS.md implementation workflow guidance

### 2. Treat table overflow as a first-pass UX audit item for preview-heavy rows

Problem:

- Preview-stack work repeatedly hit clipping from shared table styling and shell wrappers.

Proposed change:

- For any preview-heavy list/table work, explicitly inspect:
  - cell overflow
  - table wrapper overflow
  - edge-column gutter needs
  - z-index stacking above borders

Expected benefit:

- Fewer late-cycle hover/overflow regressions

Suggested place to encode:

- `improve-via-playwright` skill or repo UI rules in AGENTS.md

### 3. When modal image switching exists, always test state reset on selection

Problem:

- Thumbnail selection can look correct structurally but still preserve the wrong zoom/pan state.

Proposed change:

- Add a standard check for any modal/gallery image switch:
  - selected thumbnail changes source
  - viewport refits selected asset
  - keyboard navigation matches click navigation

Expected benefit:

- Fewer “it switched, but still feels broken” issues

Suggested place to encode:

- `improve-via-playwright` skill checklist

## Agent/System Prompt Or Skill Improvements

### 1. Add a repo-specific reminder about shared table-cell overflow

Current pain:

- Shared table recipes default to clipped cells, which is correct most of the time but hostile to image-overhang UI.

Proposed change:

- Add a short AGENTS.md note:
  - when implementing overhang/hover previews in tables, verify both `Table.Cell` and wrapper overflow; do not assume component-level `overflow: visible` is sufficient

Expected benefit:

- Faster diagnosis of clipping bugs

Suggested owner/place:

- `AGENTS.md`

### 2. Add a gallery/modal verification line to the Playwright skill

Current pain:

- Image gallery issues were partly layout issues and partly input/keyboard/state-reset issues.

Proposed change:

- Extend the Playwright skill checklist with:
  - verify thumbnail clicks
  - verify keyboard navigation
  - verify image refit/reset between selections
  - verify row-level click targets are not triggered by nested previews

Expected benefit:

- Better coverage for mixed-content gallery interactions

Suggested owner/place:

- `improve-via-playwright` skill

### 3. Add a fallback note for Prisma migration failures in post-work docs

Current pain:

- The local Prisma migration engine failed, which changed the implementation path.

Proposed change:

- Add explicit post-work guidance to capture:
  - attempted migration command
  - failure mode
  - checked-in migration path
  - whether Prisma client was regenerated

Expected benefit:

- Better handoff when schema work succeeds partially but tooling fails

Suggested owner/place:

- `post-work-doc-playbook`

## Follow-Ups And Open Risks

### Follow-ups

- Run the new archive-canvas-node migration against the target development database and confirm live CRUD behavior for:
  - pasted image nodes
  - created note nodes
  - persisted layout updates
- Add targeted browser verification for freeform canvas node creation/edit/delete.
- Consider adding per-image click targeting again only if the preview stack can be laid out with guaranteed non-overlapping hit regions.
- Consider showing image count and active image metadata inside the right-side modal rail more richly if users rely on larger galleries.

### Open risks

- The new canvas node flow depends on the `ArchivedCanvasNode` migration being applied successfully in the runtime database.
- The preview stack still intentionally balances visual overlap against interaction reliability; if users expect independent direct selection from the stack itself, additional non-overlapping layout work may still be needed.
- The image modal layout is substantially better for multi-image content, but responsive behavior on smaller screens was not deeply tuned beyond the current stacked fallback.

### None

- No additional agent/system prompt changes were made in this run.
  - Reason: improvements were identified, but not encoded yet.
