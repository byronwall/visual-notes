# Data Tables Build Plan (Phased Delivery)

## 1. Purpose
Translate the table PRD into practical, low-risk implementation phases, starting with a minimal vertical slice that gets a usable table "on the page" quickly.

## 2. Strategy
- Build one thin end-to-end path first (schema -> server actions -> UI table -> persisted edits).
- Ship value early, then deepen querying, relations, and summaries.
- Keep architecture ready for multiple view types and future charting.

## 3. Phase Overview
- Phase 0: Foundations and schema framing
- Phase 1: Minimal vertical slice (first usable table)
- Phase 2: Core UX hardening (editing/querying quality)
- Phase 3: Actionability (relations + rollup-lite)
- Phase 4: Performance and reliability
- Phase 5: Ready for visuals/charts handoff

## 4. Detailed Phases

## Phase 0: Foundations and Schema Framing
Goal: lock data contracts and migration path before UI expansion.

Detailed spec:
- `docs/data-tables/phase-0-foundation-plan-prisma.md`

Deliverables:
- Finalize table entities and initial type set.
- Prisma models + migration scaffolding.
- Server action/query stubs for table, column, row, cell CRUD.
- Seed/dev fixtures for realistic datasets.

Exit criteria:
- Schema reviewed and migration runs cleanly.
- Types compile end-to-end.
- Fixtures can create at least one sample table with 100 rows.

## Phase 1: Minimal Vertical Slice (Get It On the Page)
Goal: ship a real table people can use immediately.

Scope (must-have):
- One route/surface rendering a table from persisted data.
- Fixed initial fields: `Title` + `Status (select)` + `Date`.
- Add row, edit cells inline, save via server actions.
- Open row detail panel with rich note body editor.
- Basic table view persistence: column widths + order.

De-scoped (for speed):
- Advanced filtering UI.
- Multi-sort.
- Bulk edit.
- Relations/rollups.

UX quality bar:
- Keyboard can tab across editable cells.
- Save feedback is clear (optimistic + error fallback).
- Empty state has one obvious CTA (`Add first row`).

Exit criteria:
- A user can create a table, add/edit rows, and edit row notes without leaving the page.
- Data survives refresh and reload.
- No hydration mismatch warnings.

## Phase 2: Core UX Hardening (Editing + Querying)
Goal: make the table genuinely useful day-to-day.

Scope:
- Add remaining MVP field types: Text, Number, Multi-select, Checkbox, Created/Updated time.
- Column operations: add/delete/rename/reorder/resize/show-hide.
- Filter builder (AND/OR basic groups).
- Multi-sort.
- Quick search within table.
- Footer aggregations: count/non-empty/sum/avg/min/max.
- Bulk edit for compatible field types.

Exit criteria:
- Users can organize and query medium datasets without workaround hacks.
- Aggregations are accurate and stable under filter/sort changes.
- Interaction latency remains acceptable for ~1k rows.

## Phase 3: Actionability (Relations + Rollup-Lite)
Goal: connect tables so they support workflows, not just lists.

Scope:
- Relation column type (link rows across tables).
- Relation picker/editor UI.
- Rollup-lite computed values: count, sum, avg, min, max over related rows.
- Saved views with independent filter/sort/visibility configs.

Exit criteria:
- Users can model at least one real linked workflow (e.g., Projects -> Tasks).
- Rollup values update correctly after source row edits.

## Phase 4: Performance and Reliability
Goal: stabilize for larger datasets and collaborative usage.

Scope:
- Virtualized row rendering.
- Pagination/incremental loading strategy where needed.
- Index tuning for frequent filter/sort columns.
- Improved conflict handling and retry semantics.
- Telemetry dashboards for mutation failure rate and latency.

Exit criteria:
- Table remains smooth at target scale (2k+ rows baseline).
- Mutation failure rate and p95 latency stay within agreed SLO.

## Phase 5: Visual Layer Readiness (Pre-Charts)
Goal: ensure table model can feed chart views cleanly.

Scope:
- Normalize aggregation/query APIs for downstream charts.
- Ensure view config model supports chart view creation later.
- Add export helpers for table-to-series transformation.

Exit criteria:
- Clear API contract for chart views exists and is validated against sample datasets.
- No schema rewrites needed before starting charts.

## 5. Suggested Milestones (2-Week Blocks)
1. Milestone A (Weeks 1-2): Phase 0 + core of Phase 1.
2. Milestone B (Weeks 3-4): complete Phase 1 and stabilize.
3. Milestone C (Weeks 5-6): Phase 2 feature completion.
4. Milestone D (Weeks 7-8): Phase 3 relation/rollup-lite.
5. Milestone E (Weeks 9-10): Phase 4 scale hardening.

## 6. Recommended Minimal Vertical Slice Backlog (Ordered)
1. Create base Prisma schema + migration for table/column/row/cell.
2. Implement create-table and list-table server actions/queries.
3. Render a basic table component with Title/Status/Date columns.
4. Implement inline edit + optimistic save for those three fields.
5. Add row detail panel with notes editor bound to row.
6. Persist table layout basics (column order/width).
7. Add smoke tests + lint/type-check gate.

## 7. Dependencies and Reuse
- Reuse existing time-block patterns for typed date/status handling where practical.
- Reuse existing notes/document model for row rich body storage.
- Follow existing SolidStart data conventions (`query`, `createAsync`, server actions).

## 8. Risks by Phase
- Phase 1 risk: overbuilding generic abstractions too early.
  - Mitigation: hardcode 3 field types first, generalize in Phase 2.
- Phase 2 risk: filter/sort UX complexity slows delivery.
  - Mitigation: ship minimal but correct builder; postpone advanced nesting.
- Phase 3 risk: relation integrity bugs.
  - Mitigation: strict foreign key and delete behavior rules.
- Phase 4 risk: virtualization regressions with dynamic row heights.
  - Mitigation: fixed row height in core table; variable height only when proven.

## 9. Definition of Done (Program-Level)
1. Users can store structured records with rich notes per row.
2. Users can query and summarize data in-table without exporting.
3. Users can relate core datasets with basic rollups.
4. Code quality gates pass (`pnpm lint`, `pnpm type-check` in `app/`).
5. Architecture is ready to add chart/visual views next without core rewrites.
