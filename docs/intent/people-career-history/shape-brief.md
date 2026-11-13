---
title: "People career history — shape brief"
slug: people-career-history
phase: shape
status: current
last_updated: "2026-11-11"
---

# People career history — what we are adding

**Outcome:** Read professional history directly in People and find explained leads from shared employment periods.

**Primary flow:** Open person → scan Experience → inspect company overlap → check roles, dates, and sources.

## Feature scope

```text
People career history
├── PLANNED ADDITIONS: native experience
│   ├── Prominent Experience section in the profile's main content
│   │   ├── Companies, roles, periods, and concise responsibilities
│   │   ├── Current roles and past history; newest starts first
│   │   └── Promotions, concurrent roles, and separate returning stints
│   ├── Add, correct, and end a role; inspect its source
│   │   ├── Day, month, year, or unknown dates without invented precision
│   │   └── Current, ended, and unknown employment status
│   └── Keep employment distinct from school/church membership and encounters
├── PLANNED ADDITIONS: company overlap
│   ├── Company page shows people's roles and periods
│   ├── Profile lead opens both supporting work histories
│   └── UI and MCP distinguish recorded overlap, possible overlap, and unknown
├── PLANNED ADDITIONS: reviewed ingestion
│   ├── Preview and apply the captured career rows into native People roles
│   ├── Match people and source roles; retain corrections and report conflicts
│   ├── Repeat or resume without duplicate records
│   └── Keep source evidence outside ordinary Recent before any bulk write
└── BELOW THE CUT LINE
    ├── Automatic LinkedIn crawling, scheduled refresh, and provider integration
    ├── Relationship scoring, inferred acquaintance edges, and new graph views
    └── General resume parsing, broad company entity resolution, and public sharing
```

## Behavior

| Situation | Expected result |
|---|---|
| Source says July 2011 | Display July 2011; never imply July 1 was the hire day. |
| Role ended but its end date is unknown | Show ended with an unknown end date; exclude it from current employment. |
| Source has only an undated export listing | Show an unverified/unknown listing, not confirmed current employment. |
| Dates touch only within an uncertain month | Show possible overlap; do not claim exact shared days. |
| Company matches but dates do not establish overlap | Retain the shared-company context and say dates are insufficient. |
| Person returns to an employer | Preserve separate stints rather than filling the gap. |
| University employs a researcher | Show employment; organization type alone does not imply education. |
| Role is added or corrected | Contact history and last-contact dates stay unchanged. |
| Import conflicts with a curated role | Show the conflict before replacement. |

## Decisions and boundaries

**Appetite:** One bounded native extension: Experience, explained overlap, and a reviewed import of the five-profile sample. Existing evidence supplies enough variety. No new external service is needed.

**Key decision:** Extend the existing affiliation/organization path with explicit employment meaning. Native roles become authoritative after reconciliation. Collection rows remain source evidence, without a second ongoing editing workflow. The smaller alternative—leaving the filtered collection tables as the final interface—already works, but does not meet the request to read career history directly in People.

**Key decision:** Preserve partial ISO dates and unknown status. Keep genuinely fuzzy statements as sourced observations when they cannot support a structured period. Derive comparison bounds internally; never display those bounds as exact employment dates. Unknown legacy listings require a reviewed classification, not a blanket conversion to current jobs.

**Key decision:** Use a compact chronological list with dates aligned to roles, not nested cards or a scaled chart. Show the useful history by default. Group related roles visually while retaining their separate records and stints. Put source detail behind a nearby link. Generic affiliations remain in Organizations; a university may have both employment and membership records.

**Boundary:** Match companies by resolved organization identity. Preserve distinct source labels until a match is established. Do not silently merge related brands or renamed organizations. Keep source collections until counts and field values reconcile. No dual writes, multi-version support, or automatic deletion of evidence are needed.

**First proof:** Can the native profile show honest dates and an explained overlap without the collection bridge?

**Try:** Render two fictional profiles with a promotion, a returning stint, a current job, and an ended role with unknown dates. Use the real Experience component and the shared overlap calculation, without a database or LinkedIn session.

**Observe:** The native section shows complete readable roles and source links. A clear shared period produces a lead. A boundary-month case stays possible, and unknown dates remain unknown.

**Decide:** Continue to persistence only if the profile explains these cases without invented dates or extra navigation. If it needs prose to hide a model ambiguity, simplify the period rules first.

The [intent brief](intent-brief.md) states the desired outcome. The [implementation plan](implementation-plan.md) names the seams, checks, and import transition.
