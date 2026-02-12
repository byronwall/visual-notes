# Note Activity History UI Work Summary (2026-02-12)

## 1) Scope and Context

- Request: Add activity-based note measures to the top of the note detail page, including opened/editing counts, "last view before this one," and created/saved dates, with a popover for full note history.
- Iteration requests applied:
  - Tighten visual style (minimal borders, tighter spacing, smaller popover, icon use).
  - Move activity UI into the same compact row as path/tags chips.
  - Use relative timestamps with absolute date on hover.
- Changed area:
  - Note detail UI in `app/src/components/DocumentViewer.tsx`.
  - Compact properties row in `app/src/components/DocPropertiesCompactEditors.tsx`.
  - New activity summary/popover component in `app/src/components/DocActivitySummaryPopover.tsx`.
  - Activity data query/types in `app/src/services/activity/activity.queries.ts` and `app/src/services/activity/activity.types.ts`.
- Constraints:
  - SolidStart data loading pattern (`query()` + `createAsync()`), no direct UI `fetch()`.
  - Preserve SSR hydration safety in route-rendered UI.
  - Keep component files compact and reusable where possible.

## 2) Major Changes Delivered

- Added full note activity history query.
  - File: `app/src/services/activity/activity.queries.ts`
  - Added `fetchDocActivityHistory(docId)` returning:
    - aggregate counts (`viewCount`, `editCount`, `searchOpenedCount`)
    - `lastViewBeforeThisOne`
    - full note event list (`events`)
    - `generatedAt` anchor timestamp used for stable relative-time rendering.
- Added type for history payload.
  - File: `app/src/services/activity/activity.types.ts`
  - Added `DocActivityHistory`.
- Added compact activity summary + popover UI.
  - File: `app/src/components/DocActivitySummaryPopover.tsx`
  - Behavior:
    - summary chip shows activity metrics inline with icons
    - popover shows event list with small icon per event type
    - relative timestamps displayed; absolute UTC values shown in hover `title`.
  - Visual adjustments from user feedback:
    - reduced popover width to `min(24rem, 86vw)`
    - tighter gaps/padding and smaller row card radius
    - minimal single-pixel borders.
- Moved activity UI into path/details chip row.
  - File: `app/src/components/DocPropertiesCompactEditors.tsx`
  - Added `trailing?: JSX.Element` slot for additional compact chips.
  - File: `app/src/components/DocumentViewer.tsx`
  - Injected `DocActivitySummaryPopover` via `trailing` so it sits with `Unfiled` / `No details` chips.
- Intentionally unchanged:
  - Existing `fetchDocActivitySummary` snapshot query and snapshot recomputation flow were not replaced.
  - Existing route-level metadata and editor toolbar behavior unchanged.

## 3) Design Decisions and Tradeoffs

- Decision: Build a dedicated history query (`fetchDocActivityHistory`) instead of reusing snapshot-only data.
  - Alternative considered: use `fetchDocActivitySummary` + separate ad hoc fetch for event rows.
  - Why chosen: one query provides both top metrics and popover history consistently.
  - Tradeoff: query can return many events for highly active notes; mitigated by compact UI and internal scroll region.

- Decision: Use a server-provided `generatedAt` anchor for relative timestamp labels.
  - Alternative considered: client `Date.now()` for relative labels.
  - Why chosen: avoids SSR/client clock skew and locale mismatch during hydration.
  - Tradeoff: relative labels are anchored to query time and do not live-update each minute.

- Decision: Add `trailing` slot to compact properties row.
  - Alternative considered: keep separate activity row above path/meta chips.
  - Why chosen: user requested co-location with path/tags for denser header.
  - Tradeoff: `DocPropertiesCompactEditors` now allows optional injected UI, increasing flexibility but adding a small composition API surface.

- Decision: Keep absolute time in tooltip/title while showing relative labels inline.
  - Alternative considered: show both absolute and relative inline.
  - Why chosen: cleaner compact layout while preserving precision on demand.
  - Tradeoff: absolute timestamp discovery requires hover.

## 4) Problems Encountered and Resolutions

- Problem: intermediate type/query patching caused malformed state during implementation.
  - Symptom: duplicate `DocActivitySummary` definition and missing inserted history query.
  - Root cause: initial scripted text replacement was too aggressive.
  - Resolution: corrected via targeted `apply_patch` edits to restore proper type declarations and add the full query block explicitly.
  - Preventative action: prefer `apply_patch` for structured edits in typed modules over chained regex replacements.

- Problem: potential SSR hydration mismatch risk for timestamp rendering.
  - Symptom: locale-dependent date rendering can differ between server/client.
  - Root cause: rendering locale strings (`toLocaleString`) in first render path.
  - Resolution: switched to deterministic absolute formatting in tooltips and relative labels anchored to server `generatedAt`.
  - Preventative action: added AGENTS guidance for SSR-safe time rendering.

## 5) Verification and Validation

- Commands run:
  - `cd app && pnpm type-check`
  - Outcome: Pass (run multiple times after each major edit block).
- Manual checks performed:
  - Visual iteration by user screenshots and feedback on:
    - placement (moved into path/details row)
    - density (tighter spacing, smaller popover)
    - icon inclusion
    - relative timestamps + absolute hover behavior.
- Not run:
  - Unit/integration tests (none currently in this area).
  - `pnpm build` (intentionally skipped per repo guidance).

## 6) Process Improvements

- Use iterative UI passes with screenshot feedback before over-refactoring.
  - Problem: visual preferences were specific and changed across iterations.
  - Change: kept implementation incremental (functionality first, then layout polish, then placement).
  - Benefit: reduced rework and isolated regressions.
  - Place to encode: team workflow/checklist for UI tasks.

- Validate after each structural move (component composition changes) with type-check.
  - Problem: composition refactors can silently break props/contracts.
  - Change: ran `pnpm type-check` after each major placement/style update.
  - Benefit: caught integration issues early.
  - Place to encode: existing verification checklist conventions.

## 7) Agent/System Prompt or Skill Improvements

- Improvement added to `AGENTS.md`:
  - File: `AGENTS.md`
  - Added SSR time-label guidance under SSR-sensitive overlay controls:
    - avoid locale-dependent first-render time text in SSR paths
    - prefer deterministic text or server-anchored relative times
    - show absolute times via tooltip/title.
- Why this helps:
  - Reduces hydration mismatch risk and avoids regressions in future UI changes involving dates/times.

## 8) Follow-ups and Open Risks

- Follow-up (P2): cap or paginate history events in `fetchDocActivityHistory` for very high-volume notes.
  - Risk: popover query payload could grow too large over time.
- Follow-up (P2): extract shared relative-time utility if similar anchored rendering is needed in additional note surfaces.
  - Risk: duplicated formatting logic across components.
- Follow-up (P3): consider exposing actor/source labels with friendly mappings (e.g., `magic_user` -> `User`).
  - Risk: raw event metadata may be less readable to non-technical users.
