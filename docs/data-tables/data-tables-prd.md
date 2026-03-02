# Data Tables PRD (Notion-Style, Action-Oriented)

## 1. Document Info
- Product area: Notes + Structured Data
- Status: Draft for implementation planning
- Owner: Visual Notes product/engineering
- Last updated: 2026-02-24

## 2. Problem Statement
Current notes are flexible but weak for repeated structured workflows. Users need to capture operational data inside notes, then sort/filter/relate it to make decisions and take action. The current time-block feature validates the demand for structured entries; now we need a generalized data table system.

## 3. Vision
Build a Notion-like, page-native table system where each row can store both structured fields and rich notes, with a table UX that feels fast, legible, and reliable. Start simple, but establish foundations for later charts, dashboards, and automations.

## 4. Goals
1. Deliver a high-quality table experience first (data entry, scanning, sorting, filtering).
2. Support a useful subset of typed fields that cover 80% of planning/tracking workflows.
3. Enable minimal relations and aggregations so tables are actionable, not just storage.
4. Keep notes first-class: each row supports rich body content, not only metadata columns.
5. Preserve SSR/hydration safety and existing SolidStart data patterns.

## 5. Non-Goals (Initial Release)
- Full Notion parity.
- Complex formula language.
- Advanced permissions/workspace sharing models.
- Charts/visual analytics UI (planned after table maturity).
- External integrations and automation engines.

## 6. Personas and Primary Jobs
- Builder/Founder: tracks projects, next actions, due dates, and status in one place.
- Operator: logs recurring data, needs quick edits and bulk updates.
- Planner: relates records across domains (e.g., Projects <-> Tasks, Clients <-> Meetings).

Primary jobs:
1. Capture rows quickly.
2. Keep critical metadata structured and queryable.
3. Open row details for full narrative notes.
4. Surface what matters now with filters, sorts, and simple summaries.

## 7. UX Principles
1. Grid-first speed: keyboard and inline editing should feel spreadsheet-fast.
2. Typed clarity: each column has a clear type and editor.
3. Progressive disclosure: table for scanning, row detail for depth.
4. Stable mental model: one dataset, many views; view config does not mutate core data.
5. Practical defaults: users should get value without heavy setup.

## 8. Feature Scope by Tier

### 8.1 Tier A: Core MVP (must ship first)
- Table block/page with:
  - Column headers, rows, add-row, add-column.
  - Reorder columns, resize columns, show/hide columns.
- Row model:
  - Row has required `Title` field.
  - Row opens a detail panel/page with rich note body.
- Field types:
  - Title, Text, Number, Select, Multi-select, Date, Checkbox, Created time, Updated time.
- Editing:
  - Inline cell edit with type-specific controls.
  - Multi-row selection + bulk set for compatible field types.
- Querying:
  - Per-view single/multi filter groups (AND/OR basic nesting).
  - Multi-sort.
  - Quick search within current table.
- Views:
  - Table view only (initially), but architecture supports multiple views later.
- Basic summaries:
  - Column footer aggregations: Count, Non-empty count, Sum, Average, Min, Max.
- Performance targets:
  - Smooth interaction up to ~2,000 rows in standard table view.

### 8.2 Tier B: Actionability Expansion (next)
- Relation field:
  - Link row(s) to another table.
  - Show relation as chips/titles.
- Rollup-lite:
  - Over a relation, support: Count related rows, Sum/Avg/Min/Max numeric child field.
- View usability:
  - Saved views (same dataset, different filters/sorts/visible columns).
  - Optional freeze first column.
- Better keyboard model:
  - Arrow navigation, Enter edit/commit, Tab traversal.

### 8.3 Tier C: Notion-Style Maturity (later)
- Additional field types: URL, Email, Phone, Person, File.
- Formula-lite (restricted expressions).
- Grouping by one field.
- Board/Calendar timeline-style alternate views.
- Chart view and visual dashboards.

## 9. Data Model (Logical)

### 9.1 Entities
- `table`
  - `id`, `workspace_id`, `name`, `description`, timestamps.
- `table_view`
  - `id`, `table_id`, `name`, `type` (`table` initially), serialized config (filters/sorts/visible columns/order/widths).
- `table_column`
  - `id`, `table_id`, `name`, `slug`, `type`, `settings_json`, `position`, timestamps.
- `table_row`
  - `id`, `table_id`, `title`, `notes_doc_id` (rich body), timestamps, created_by/updated_by.
- `table_cell`
  - `row_id`, `column_id`, typed value fields or normalized JSON payload.
- `table_relation` (Tier B)
  - `id`, `source_table_id`, `source_column_id`, `target_table_id`, cardinality config.

### 9.2 Type System (Initial)
- `title`: required string.
- `text`: long/short text.
- `number`: decimal with display format option.
- `select`: one option from enum.
- `multi_select`: multiple enum options.
- `date`: date or datetime (start with date-only acceptable).
- `checkbox`: boolean.
- `created_time`, `updated_time`: system-generated readonly.
- `relation` (Tier B): references other rows.
- `rollup` (Tier B): computed aggregate via relation.

### 9.3 Value Storage Guidance
- Prefer typed DB columns or strongly validated JSON schema per type.
- Enforce parse/validation at server action boundary.
- Keep deterministic serialization for filters/sorts.

## 10. UX/UI Requirements

### 10.1 Table Surface
- Header row with clear type affordances and sort/filter indicators.
- Dense but readable row height with optional wrap toggle per column.
- Sticky header; optional sticky first column in Tier B.
- Empty states:
  - No rows: clear CTA to add first row.
  - No columns beyond title: CTA to add property.

### 10.2 Row Detail Experience
- Open mode for MVP: side panel preferred to keep table context.
- Detail layout:
  - Editable property list.
  - Rich note body below/alongside properties.
- Must preserve unsaved edits on incidental close/navigation where possible.

### 10.3 Interaction Quality
- Optimistic updates for common edits with rollback on server error.
- Clear loading/error states for save conflicts.
- Multi-user collision baseline:
  - Last-write-wins initially, with visible updated timestamp.

## 11. Functional Requirements
1. User can create/delete/rename table.
2. User can add/delete/rename/reorder columns.
3. User can add/delete rows.
4. User can edit any editable cell with type-safe validation.
5. User can open row detail and edit rich note content.
6. User can create at least one additional saved table view with independent config.
7. User can filter and sort by supported types.
8. User can compute footer summaries for numeric/supporting types.
9. Tier B: user can create relations and view rollup-lite results.

## 12. Technical Constraints and Architecture Notes
- SolidStart patterns:
  - Reads via `query()` + `createAsync()`.
  - Writes via server actions.
  - Avoid ad-hoc client fetch for app data.
- SSR/hydration:
  - Render same initial table shell server/client.
  - Avoid client-only table mount except browser-API-only subfeatures.
- Component architecture:
  - Keep route modules thin; reusable table UI under `app/src/components/`.
  - Split cell editors by type to avoid monolith files.

## 13. Observability
- Structured logs with stable prefixes, e.g. `[data-table]`, `[data-table-filter]`.
- Track key product metrics:
  - Tables created/week.
  - Rows added/week.
  - Filter/sort usage.
  - Relation column adoption.
  - Row detail open rate.

## 14. Success Metrics
- Activation: user creates table and adds >=5 rows in first session.
- Actionability: >=40% of active tables use filters or sorts weekly.
- Depth: >=30% of rows have non-empty rich note body.
- Reliability: <1% failed mutation rate in production logs.

## 15. Risks and Mitigations
- Risk: table complexity explodes early.
  - Mitigation: strict type subset and tiered rollout.
- Risk: performance degrades with row count.
  - Mitigation: row virtualization path, query pagination, indexed sort/filter columns.
- Risk: relation/rollup data integrity issues.
  - Mitigation: typed relation schema + constrained rollup operators.
- Risk: UX feels "like a DB tool" instead of notes-native.
  - Mitigation: keep row detail note body central and frictionless.

## 16. Open Questions
1. Should row detail open as side panel only in MVP, or allow center/full modes immediately?
2. Do we require date-time in MVP or can date-only ship first?
3. Should select options be table-global per column (recommended) or ad-hoc per cell?
4. What row count target defines MVP performance gate in your real datasets?

## 17. Acceptance Criteria (MVP Release)
1. A user can build a table with at least 8 supported field types and 500+ rows without UX breakdown.
2. Inline editing, bulk edit, filters, and multi-sort are functional and persisted per view.
3. Each row supports rich note body editing from row detail.
4. Footer aggregations (count/sum/avg/min/max where applicable) display accurate values.
5. Lint and type-check pass for app changes associated with table MVP.
