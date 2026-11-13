---
title: "People career history — implementation plan"
slug: people-career-history
phase: plan
status: current
last_updated: "2026-11-11"
---

# People career history — implementation plan

## Plan at a glance

First prove the native Experience display and period rules with fictional profiles. Then persist the same records through the existing People stores and MCP tools. Add explained overlap and a reviewed import from the captured collection after those semantics hold.

The five-profile pilot already proves acquisition and retention. Another LinkedIn browser integration is unnecessary for implementation. Its 41 rows provide patterns to reproduce with synthetic fixtures: promotions, concurrent jobs, returning stints, month dates, and shared employment. Do not commit the private capture as test data.

Keep the current collection tables as evidence until native records reconcile. Native affiliations then own role editing and queries. Do not maintain two writable career systems. No tickets, deployment, or production migration are part of this documentation PR.

## Implementation strategy

- **Primary seam:** Extend `PersonAffiliation` and the existing profile/organization stores. Distinguish employment from other affiliations independently of organization type.
- **Period contract:** Preserve nullable partial ISO strings (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) and explicit current/ended/unknown status. Keep a truly fuzzy statement in a sourced observation when it cannot support a structured endpoint. Internal comparison bounds do not become displayed dates.
- **Source contract:** A role retains its source label, URL or linked note, observation date, source namespace, and stable role key. Keep responsibilities separate from the profile summary.
- **First local loop:** Add `src/lib/people/career-periods.test.ts` in milestone 1, then run `cd app && pnpm exec vitest run src/lib/people/career-periods.test.ts`. This is a proposed command, not a test already present or run.
- **Visible proof:** Add a small Solid/Vite fixture under `app/scripts/people-career-proof/` that renders the actual component with synthetic profiles. Reuse installed tooling. It must not import the database or read production configuration.
- **Database proof:** Local Postgres listens on port 5432. No safe test database was provisioned during planning. Before persistence or browser tests, use the existing guarded `pnpm audit:db -- --owner people_career` flow. Confirm its loopback audit target before seeding or applying migrations. Defer database proof if that target cannot be established.
- **Transition:** Use one application version and one native authority. Retain the source collection and a reconciliation manifest for recovery. No dual writes or mixed-version fallback are planned.

### Dependency proof strategy

LinkedIn is absent from the development loop. Synthetic role values prove the application contract. A dedicated local Postgres database proves migration, persistence, identity uniqueness, and resume behavior. Local authenticated UI/MCP checks prove matching reads and writes. A later, separately authorized deployed smoke confirms real data wiring; live production is not the failure-testing environment.

## Milestone 1: A native Experience view explains dates and overlap

Create the shared period representation and one compact Experience component. Render it in the isolated fixture with two fictional people. Include a university employment role and a separate school membership, so organization type cannot select the wrong record.

Use dates beside role/company text, full readable titles, and ordinary source links. Visually group related roles without merging their underlying records. Preserve returning stints and show concurrent current jobs. Put this section before low-information or empty memory/history content in the professional profile composition.

Implement one pure comparison function. Derive earliest/latest possible endpoints from the stated precision. Report overlap only when the available evidence supports it. Treat an uncertain shared boundary month as possible, unknown boundaries as insufficient evidence, and separated periods as no overlap. Limit current-role claims to their observation date for comparisons; never extend stale evidence indefinitely.

Keep focused tests for those date rules and a few representative browser assertions. Add the fixture launcher command to its README. No schema migration or live data is needed here.

### Desired end state

- The actual Experience component shows history without a collection embed.
- Partial dates, unknown status, concurrent work, and returning stints are understandable without explanatory workarounds.
- The comparison result exposes the supporting roles and its uncertainty; a screenshot and focused tests prove this behavior.

## Milestone 2: Native roles persist and UI/MCP agree

Extend the Prisma affiliation model, shared schemas/types, profile store, person update path, and organization store. Employment needs its own discriminator, explicit status, partial endpoints, source information, observation date, responsibilities, and source role key. Reuse generic organization and note records.

Generate migrations through Prisma. Inspect generated SQL and any needed data conversion. Preserve existing exact dates as exact dates. Classify known imported snapshots as unknown unless reviewed evidence establishes current or ended status. Do not guess the meaning of ambiguous legacy records; report them for review. Keep other memberships out of the employment projection.

Wire the native Experience section into `PersonProfileView.tsx`. Add role editing and source inspection through existing action/query patterns. Update current-role selection, company member views/counts, MCP formatting, and MCP writes together. Rename the existing encounter heading to Interaction history where needed to remove ambiguity.

On the isolated audit database, save, reload, correct, and end a role. Test an ended job without a known end date. Confirm employment writes leave facts, encounters, and last contact unchanged. Verify linked source data stays private. Run `pnpm lint`, `pnpm type-check`, and `pnpm test:people` with the guarded test database enabled; a skipped database suite is not persistence proof.

### Desired end state

- Real native records survive reload and return the same status, period, and source through UI and MCP.
- An undated listing is not presented as confirmed current work.
- Generic affiliations still work, and the source collections remain readable without becoming a second editing authority.

## Milestone 3: People can inspect overlaps and import history without duplicates

Use the shared comparison in profile leads, company membership queries, and MCP relationship/organization reads. Compare resolved organization identities and distinct people. Return both roles, their stated periods, the supported intersection, and an uncertainty label. Explain a shared company with unknown dates separately. Do not turn any result into a confirmed relationship edge.

Add a narrow reviewed ingest path for the existing collection rows. Resolve the person using the saved People URL and corroborating source profile identity. Use the collection row ID as a stable key for this captured source. Register person external identities through the existing mechanism; give roles their own stable source keys. Keep changed titles and new stints distinct from corrections. Report ambiguous company labels instead of merging them by name.

Preview additions, matches, and conflicts before applying. Reuse/update existing affiliations only with clear identity evidence. Retain curated values and record decisions. Set source archive row visibility off before creating any evidence. Re-read the archive setting; if setup fails, stop before the first source write. Preserve original sources and a source-to-record manifest.

Prove this on synthetic collection rows first. Reapply the same input and resume after an injected partial failure. Both must create zero duplicates. The later authorized live transfer must reconcile all 41 captured roles, including 9/6/12/8/6 per person, before replacing the temporary history links with the native view.

### Desired end state

- Company overlaps are explained consistently in UI and MCP, without inferred acquaintance.
- A reviewed import preserves month values, sources, returning stints, and curated changes.
- Repeat and resume create no duplicate people, roles, facts, encounters, or source notes. Importing does not flood Recent or alter contact dates.

## Integration and recovery

The main modules are `app/prisma/schema.prisma`, `src/lib/people/`, `src/server/people/{profile-store,person-store,organization-store,relationship-store,import-store}.ts`, `src/server/mcp/people-{tools,format}.ts`, `src/services/people/`, and `src/components/people/`. Keep routes compositional. Update seed data and the focused People tests with each behavior change.

Open PRs were inspected on November 11. PR #328 contains a Collections audit and its own fixtures. PRs #327, #298, and #212 contain research docs. None changes the proposed People core modules. The collection audit is related context, not a required base. No current merge-order decision is needed.

Take a data backup before any authorized migration or live import. Validate the generated migration and export a reconciliation manifest on the audit database first. On failure, stop the apply, keep source evidence and existing records, and resume through stable keys. Revert the code change or use the verified backup for a failed data conversion. Do not delete or rewrite the source collection as rollback.

## Below the cut line

- Automatic LinkedIn synchronization, provider APIs, scheduled scraping, and generic profile parsing.
- General company merging, relationship scores, new graphs, and public People views.
- A generalized ingestion framework, dual write architecture, or mixed-version compatibility.
- Live migration or import before the synthetic and audit-database proofs pass.
