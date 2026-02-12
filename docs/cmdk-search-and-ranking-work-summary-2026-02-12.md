# CMD+K Search and Ranking Work Summary (2026-02-12)

## 1) Scope and Context

- Requested scope:
  - Diagnose why searching `"visual notes"` could miss a note like `"improving visual notes"` while `"improving visual"` worked.
  - Bring CMD+K search controls to parity with Notes Index for `sortMode` and `activityClass` only.
  - Tighten CMD+K layout (controls right-aligned on input row, remove extra header/sub-label).
  - Show meaningful default items in CMD+K before typing (not blank), ideally activity-aware.
- Areas changed:
  - `app/src/features/docs-index/data/docs.queries.search.ts`
  - `app/src/components/CommandKMenu.tsx`
- Constraints:
  - Reuse existing SolidStart query/action patterns and existing docs-index services.
  - Preserve SSR-safe overlay behavior (`SimpleSelect` with `skipPortal` and mount-safe fallback).
  - Keep UI vertically compact.

## 2) Major Changes Delivered

- Fixed multi-word search miss behavior in server search ranking:
  - File: `app/src/features/docs-index/data/docs.queries.search.ts`
  - Added token coverage tracking (`tokenHits`) and normalized exact-phrase detection (`hasExactTerm`).
  - For multi-token queries, results now must either:
    - match the full normalized phrase, or
    - cover all query tokens across title/path/section text.
  - Behavior impact:
    - Adding a trailing word now narrows results instead of broadening to noisy single-token matches.

- Added CMD+K sort + activity controls with Notes Index parity:
  - File: `app/src/components/CommandKMenu.tsx`
  - Added `SimpleSelect` controls for:
    - `sortMode`: `relevance`, `recent_activity`, `most_viewed_30d`, `most_edited_30d`
    - `activityClass`: `""`, `READ_HEAVY`, `EDIT_HEAVY`, `BALANCED`, `COLD`
  - Wired both into `searchDocs(...)` requests.

- Added CMD+K non-blank empty-state feed ("most likely to open"):
  - File: `app/src/components/CommandKMenu.tsx`
  - Empty query now calls `fetchDocs(...)` (activity-aware list query) instead of returning no hits.
  - Empty-state sort behavior:
    - if selected sort is `relevance`, it maps to `recent_activity` (because relevance requires a query term).
    - otherwise honors selected sort + activity class.
  - Behavior impact:
    - CMD+K opens with actionable likely documents before typing.

- Compressed CMD+K visual layout:
  - File: `app/src/components/CommandKMenu.tsx`
  - Moved select controls onto the same row as the search input.
  - Right-aligned controls with input expanding to fill remaining width.
  - Removed dialog heading/sub-label by omitting `title` and `description`.
  - Kept close control and results list behavior unchanged.

- Intentionally unchanged:
  - Did not add other Notes Index filters (path/meta/source/date/originalContentId) to CMD+K.
  - Did not alter Notes Index page UI/behavior.

## 3) Design Decisions and Tradeoffs

- Decision: enforce multi-token coverage in server-side search results.
  - Alternative considered: keep broad OR matching and only boost scoring for full-token hits.
  - Why chosen: score-only boosting can still bury expected results under high-volume single-token matches; hard gating improves precision for phrase-like searches.
  - Tradeoff: stricter filtering can exclude partial matches users might still want; mitigated by allowing exact normalized phrase matches.

- Decision: normalize text for phrase checks (`_`, `-`, `.` -> space).
  - Alternative considered: raw lowercase `includes` only.
  - Why chosen: raw includes misses common separator variants in titles/paths.
  - Tradeoff: slight looseness in what counts as phrase-equivalent.

- Decision: reuse existing `fetchDocs(...)` for CMD+K empty state.
  - Alternative considered: build a dedicated "command palette recommendations" query.
  - Why chosen: faster delivery, existing activity-based orderings already implemented in list query.
  - Tradeoff: empty-state ranking is heuristic "likely next open" based on existing activity snapshots, not a separate recommendation model.

- Decision: map empty-state `relevance` to `recent_activity`.
  - Alternative considered: keep no-op relevance for empty query.
  - Why chosen: relevance without query has no signal; recent activity is a defensible default.
  - Tradeoff: selection label can still display "Relevance" while behavior falls back to recent activity when query is empty.

## 4) Problems Encountered and Resolutions

- Problem: search miss on trailing-word query (`"visual notes"`).
  - Symptom: expected doc could be missing even though shorter related query worked.
  - Root cause: OR-based token matching let common tokens dominate candidate set/ranking.
  - Resolution: introduced multi-token coverage gating plus normalized exact-phrase allowance.
  - Preventative action: documented relevance-based behavior here and retained deterministic token coverage logic in one query module.

- Problem: CMD+K looked vertically heavy and had extra unused header copy.
  - Symptom: controls consumed a second row and left unnecessary blank top space.
  - Root cause: controls were initially added below input and dialog included heading + description.
  - Resolution: merged controls into the input row, right-aligned them, removed title/description props.
  - Preventative action: keep command palette layout benchmark as "single compact top row + results".

## 5) Verification and Validation

- Commands run:
  - `pnpm type-check` (in `app/`) after each functional/layout update.
  - Outcome: Pass (`tsc --noEmit` with "Type check passed").

- Manual validation performed through iterative UI feedback:
  - Confirmed control placement changes (below input -> right side of input row -> tight to right edge).
  - Confirmed header/sub-label removal.
  - Confirmed request to show non-blank default CMD+K results was implemented.

- Not run:
  - Unit/integration tests: None available for this flow in current repo setup.
  - Browser automation/screenshot tests: not run in this session.

## 6) Process Improvements

- Improvement: use behavior-first iteration checkpoints for UI micro-layout tasks.
  - Problem: small layout requests can require multiple rounds ("right side", then "tighter to edge", then "remove header").
  - Change: apply minimal incremental patches with immediate type-check + quick visual intent confirmation.
  - Expected benefit: lower churn and faster convergence on exact UI positioning.
  - Where to encode: team/frontend checklist for command palette edits (repo docs).

- Improvement: separate relevance logic from empty-state ranking explicitly.
  - Problem: relevance semantics differ when query is empty.
  - Change: codified explicit fallback (`relevance` -> `recent_activity`) for empty state.
  - Expected benefit: predictable behavior and easier future tuning.
  - Where to encode: docs for search ranking rules (this report + future search docs).

## 7) Agent/Skill Improvements

- Proposed improvement: add a "CMD+K compactness checklist" to AGENTS or a UI skill.
  - Current pain: repeated guidance needed for top-row density and right-edge anchoring.
  - Proposed change:
    - include explicit checks:
      - input fills remaining width
      - controls grouped at far right
      - no extra header text for command palette unless explicitly requested
      - non-empty default result state
  - Expected benefit: fewer back-and-forth turns on command-palette polish tasks.
  - Suggested owner/place: `AGENTS.md` UI composition section or a dedicated command-palette playbook skill.

- Proposed improvement: add a search-relevance regression note/template.
  - Current pain: token-OR regressions are easy to reintroduce.
  - Proposed change: document expected behavior for multi-token queries ("all tokens or exact normalized phrase").
  - Expected benefit: safer future ranking changes.
  - Suggested owner/place: docs search architecture note or comments in `docs.queries.search.ts`.

## 8) Follow-ups and Open Risks

- Follow-ups:
  - Add targeted tests for `searchDocs` ranking/filter behavior:
    - multi-token coverage requirements
    - normalized phrase matching (`-`, `_`, `.` separators)
    - empty-query CMD+K fallback behavior.
  - Consider persisting CMD+K `sortMode`/`activityClass` between openings if desired UX is stable preference memory.

- Open risks:
  - Stricter multi-token gating may hide some intentionally broad exploratory searches.
  - Empty-state recommendation quality depends on freshness/quality of `docActivitySnapshot` data.
  - No automated tests currently enforce the new search ranking constraints.
