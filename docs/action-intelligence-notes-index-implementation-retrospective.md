# Action Intelligence + Notes Index Layout Implementation Retrospective

## 1) Scope and Context

- Request: implement action intelligence/event tracking + activity timeline + ranking/filtering signals, then iterate on notes index and activity page UI hierarchy/layout.
- Areas changed:
  - Data model and migrations (`app/prisma/schema.prisma`, `app/prisma/migrations/20260212040728_add_action_events_activity_rollups/migration.sql`)
  - Event logging/aggregation services (`app/src/server/events/action-events.ts`, `app/src/services/activity/*`)
  - Instrumentation in docs/AI/admin actions (`app/src/services/docs.actions.ts`, `app/src/features/docs-index/data/docs.actions.ts`, `app/src/services/ai/*`, `app/src/services/admin/inline-image-migration.actions.ts`)
  - Search/list ranking and docs-index query state (`app/src/features/docs-index/data/docs.queries.search.ts`, `app/src/features/docs-index/data/docs.queries.list.ts`, `app/src/features/docs-index/state/docsQuery.ts`)
  - New user-facing activity route and navigation (`app/src/routes/activity.tsx`, `app/src/components/sidebar/AppSidebarNav.tsx`)
  - UI refinement passes across notes index top controls and list density (`app/src/features/docs-index/components/*`)
- Constraints:
  - Prisma schema changes must use CLI-generated migrations.
  - Solid SSR hydration stability needed during UI refactors.
  - Search payload policy required metadata-only logging (no raw sensitive content by default).
  - Existing SolidStart data patterns (`query()` + `createAsync()`) retained.

## 2) Major Changes Delivered

- Added append-only event storage and rollups:
  - `ActionEvent`, `DocActivityDaily`, `DocActivitySnapshot` + enums in `app/prisma/schema.prisma`.
  - Created/applied migration `app/prisma/migrations/20260212040728_add_action_events_activity_rollups/migration.sql`.
- Built shared event logger and doc activity aggregation:
  - `app/src/server/events/action-events.ts` implements best-effort logging, daily increments, 30-day snapshot recompute, and activity class assignment.
- Added activity service surface:
  - `app/src/services/activity/activity.queries.ts` timeline + per-doc summary.
  - `app/src/services/activity/activity.actions.ts` snapshot recompute + doc view/search-result event actions.
  - `app/src/services/activity/activity.service.ts` barrel export.
- Instrumented major flows:
  - Doc create/update/delete and bulk actions now emit structural events.
  - AI chat/prompt and admin migration batches emit start/finish/interaction events.
- Added user-facing timeline page:
  - `app/src/routes/activity.tsx` with filters, links, payload chips.
  - Added sidebar nav entry in `app/src/components/sidebar/AppSidebarNav.tsx`.
- Integrated ranking/filtering signals into docs index:
  - Query inputs include `activityClass` and `sortMode`.
  - Search ranking blends text score with recency/views/edits/intent signals.
  - List sorting supports recent activity / most viewed / most edited.
- Added contextual activity details:
  - Timeline query now joins related doc title/path (`app/src/services/activity/activity.queries.ts`).
  - Search events include `queryPreview`; result-open events include doc title.
- Delivered multiple UI refinement passes:
  - Activity page visual hierarchy improved (cards, chips, clearer metadata rows).
  - Notes index controls flattened and compacted.
  - Selection controls moved to popover.
  - Results count moved to top control row.
  - Section-level spacing tightened while preserving row padding.
- Intentionally unchanged:
  - No unit test suite added (repo currently relies on type-check + manual validation).
  - Existing docs data-access pattern and route ownership retained.

## 3) Design Decisions and Tradeoffs

- Decision: event log + aggregate tables instead of direct counters on `Doc`.
  - Alternative: counters-only on `Doc`.
  - Why chosen: supports lineage/audit timeline and ranking/filtering without losing event detail.
  - Tradeoff: more schema complexity and write-path overhead.
- Decision: metadata-only search event payloads.
  - Alternative: store full search text.
  - Why chosen: privacy/sensitivity policy and lower risk surface.
  - Tradeoff: less forensic detail; mitigated by `queryPreview` truncation for operator context.
- Decision: blended ranking in search (`text + behavior boosts`) with text relevance dominance.
  - Alternative: behavioral signals only as tiebreakers.
  - Why chosen: better intent surfacing while preserving query relevance.
  - Tradeoff: more tuning complexity and potential ranking regressions if weights drift.
- Decision: best-effort logging (no user-action failure on event write failure).
  - Alternative: strict transactional failure propagation.
  - Why chosen: reliability of primary UX over analytics completeness.
  - Tradeoff: possible telemetry gaps during logger/database issues.
- Decision: add shared ParkUI panel popover wrapper.
  - Alternative: keep ad hoc `SimplePopover` usages with inline style overrides.
  - Why chosen: consistent spacing/padding and reusable popover patterns.
  - Tradeoff: one more UI wrapper to maintain.

## 4) Problems Encountered and Resolutions

- Problem: Prisma migration generation failed initially with schema engine error.
  - Symptom: `pnpm prisma migrate dev --name add_action_events_activity_rollups` failed before migration generation.
  - Root cause: local DB/schema engine access issue in sandbox context.
  - Resolution: reran with elevated permissions; migration generated and applied.
  - Preventative action: for schema-changing tasks, run migration command early and retry with escalation immediately if blocked.
- Problem: Docs index SSR `template2` hydration error after controls changes.
  - Symptom: hydration mismatch in docs index page.
  - Root cause: SSR/client divergence risk around newly-added select controls.
  - Resolution: applied mount-gated rendering fallback and `skipPortal` in `app/src/features/docs-index/components/FiltersPanel.tsx`.
  - Preventative action: for Ark/Park overlay controls in SSR paths, default to hydration-safe gating strategy.
- Problem: Selection popover appeared visually broken despite style props.
  - Symptom: popover padding/width looked wrong.
  - Root cause: `SimplePopover` ignored `class`/`style` props and did not pass them to `Popover.Content`.
  - Resolution:
    - Fixed pass-through in `app/src/components/ui/simple-popover.tsx`.
    - Added reusable `app/src/components/ui/panel-popover.tsx` and migrated Actions/Selection popovers.
  - Preventative action: keep wrapper APIs and render targets aligned; validate style prop forwarding when creating wrapper components.

## 5) Verification and Validation

- Commands run:
  - `pnpm prisma migrate dev --name add_action_events_activity_rollups` (pass after escalation)
  - `pnpm type-check` (pass; run repeatedly after major edits)
- Manual/UI checks performed (conversation-driven):
  - User-reviewed screenshots for activity page and notes index layout iterations.
  - Verified follow-up adjustments based on visual feedback (control grouping, popover quality, spacing density).
- Gaps:
  - No automated integration/e2e tests were run (none configured in workflow).
  - No formal load/perf validation for new ranking + timeline queries was run.

## 6) Process Improvements

- Improvement: tighten loop for UI-heavy tasks with screenshot feedback checkpoints.
  - Pain: large one-shot layout changes caused multiple rounds of “close but not right”.
  - Change: ship smaller, target-specific layout deltas (controls, popover, spacing) per feedback.
  - Benefit: faster convergence and lower churn.
  - Encode in: team workflow checklist for UI tasks (`docs/` checklist or AGENTS section).
- Improvement: run migration before broad implementation when schema is involved.
  - Pain: late migration issues interrupt flow.
  - Change: create/apply migration immediately after schema edits.
  - Benefit: early failure detection and faster unblock.
  - Encode in: AGENTS “Prisma rules” checklist.

## 7) Agent/Skill Improvements

- Missing instruction discovered: wrapper component audits should explicitly verify prop passthrough.
  - Problem: `SimplePopover` style props were silently ignored.
  - Proposed change: add an instruction to a UI wrapper skill/checklist: “when creating wrapper components, verify external props are forwarded to effective rendered slot(s).”
  - Expected benefit: fewer visual regressions from wrapper abstraction bugs.
  - Suggested owner/place: add to `/Users/byronwall/Projects/visual-notes/AGENTS.md` UI composition section and/or a dedicated UI-wrapper skill.
- Missing instruction discovered: SSR overlay controls need a default safe pattern.
  - Problem: hydration mismatch surfaced with select/portalized controls.
  - Proposed change: add explicit “SSR-safe overlay control pattern” note (mount gate or deterministic fallback) to Solid SSR skill.
  - Expected benefit: fewer `template2` hydration regressions.
  - Suggested owner/place: `/Users/byronwall/Projects/visual-notes/.agents/skills/solid-ssr-change-safety/SKILL.md`.

## 8) Follow-ups and Open Risks

- Follow-ups:
  - Add snapshot backfill/admin trigger UI for `recomputeDocActivitySnapshots` action.
  - Add indexes/query review for timeline filters under high event volume.
  - Add minimal e2e checks for docs-index SSR hydration and activity route rendering.
- Open risks:
  - Ranking weight calibration may need tuning with real usage data.
  - Best-effort logging can cause telemetry gaps during transient DB failures.
  - Query preview currently stored as truncated metadata string; this is useful context but still user-originated text.
- Priority suggestions:
  1. High: add smoke/e2e coverage for SSR hydration and key controls.
  2. Medium: implement ranking-weight feature flag/config for easier tuning.
  3. Medium: add dashboard-level observability for event write failures and snapshot lag.
