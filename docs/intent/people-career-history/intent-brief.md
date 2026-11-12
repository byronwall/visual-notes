---
title: "People: career history and company overlap"
slug: people-career-history
phase: intent
status: current
last_updated: "2026-11-11"
---

# People: career history and company overlap

## My read

Byron wants to open a person in Visual Notes and understand their professional history. The useful view shows companies, roles, and employment periods in time order. It includes past jobs, promotions, concurrent roles, and returns to a previous employer. A current title in a page header does not meet this need.

The second job is to find people who may know each other because their employment overlapped. A useful result names the company, both roles, and the supporting period. It helps Byron judge whether a connection or introduction is worth exploring. Shared employment suggests a lead; it does not prove acquaintance.

The recent imports exposed two different gaps. The connection export had only company/title snapshots. The importer also placed messages and historical context in summaries instead of using existing fact and encounter records. Those records have since been cleaned up. A five-person Chrome pilot then recovered 41 LinkedIn roles with month-level dates. They now exist as separate collection rows and filtered tables linked from People.

That pilot proves the information is available and can be retained. It does not deliver the requested native People experience. Byron's repeated objection concerns the missing career timeline, not merely missing text. The next scope must put professional history on the profile itself and make it available to agents through MCP.

## What matters most

- Read a person's previous roles, companies, and dates without opening a separate collection.
- Compare people through dated employment at the same resolved company.
- Preserve the precision, uncertainty, and source of each employment claim.
- Keep summaries short; store facts, encounters, employment, and source evidence separately.
- Support the same records and rules through the UI and MCP.

## The experience or behavior you appear to want

Open a person and scan their Experience section. Follow a company to see relevant people and periods. Inspect a shared-company lead to compare both work histories and understand uncertainty. Open the original source when a date or role needs checking. Correct a role without losing earlier history.

Experience is distinct from interaction history. A birthday message belongs in encounter history; it does not describe a career. An employer mentioned in an old message is evidence about work at that time, not proof of an exact hire date.

## Boundaries

People and imported evidence remain private. Employment changes do not change contact recency. Company membership never creates a confirmed relationship edge automatically.

Do not invent days to fit month-only dates. Do not treat unknown departure dates as current employment. Do not infer continuous employment between sparse observations. Keep an application, a proposed meeting, and a completed encounter distinct.

Source notes must stay accessible without filling ordinary Recent or notes browsing. The existing archive collection setting already supplies this behavior. Preserve that working separation.

This initiative does not require automatic LinkedIn synchronization, a new scraping service, a complete communication archive, or a new graph. The current PR prepares scope and implementation; it does not authorize additional collection, production migration, or deployment.

## What seems settled

Career history and dated company overlap are core goals. The five-profile collection is a working bridge, not the desired final People interface. Reuse the captured records for implementation proof. Read source dates as evidence, and label suggested connections honestly.

The precise database fields and layout are implementation choices within these constraints. The [shape brief](shape-brief.md) recommends the smallest coherent native extension.

## Current reality that matters

People already has affiliations, organizations, sourced facts, encounters, import identities, and MCP tools. Affiliations accept exact optional days, but lack independent employment status and role provenance. The profile puts affiliations in the side column. Shared-company leads ignore dates.

The cleanup preserved 196 message records and left contact dates unchanged. The later pilot added 41 role rows with exact source month values. Source evidence and data acquisition are therefore established for a useful sample. Native Experience rendering, uncertain date semantics, and role reconciliation remain unfinished.

## Next step after confirmation

Review the [shape](shape-brief.md) and follow the [proof-first plan](implementation-plan.md). Start with fictional profiles and no live LinkedIn dependency. Keep the imported collection evidence until the native read, import, and overlap results reconcile.
