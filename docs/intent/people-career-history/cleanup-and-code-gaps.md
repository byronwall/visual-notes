# People cleanup and remaining code gaps

Completed November 11, 2026 through the Visual Notes MCP tools. This records the applied cleanup, not just the earlier dry run. Application code was not changed.

## Applied and verified

| Item | Before | After |
|---|---:|---:|
| People | 40 | 40 |
| Summary text, total characters | 65,902 | 3,313 |
| Profiles missing how-known context | 20 | 0 |
| Sourced facts | 18 | 36 |
| Unique interactions | 40 | 62 |
| Source conversations retained as notes | 0 | 46 |
| Profile-to-source links | 0 | 48 |

Seventeen reviewed facts were added. One existing fact mixed employment observations from different years; it was split into two sourced facts. All 18 existing facts now link to source notes.

Twenty-two earlier interactions were added. Five record confirmed encounters; the others record useful earlier message exchanges and a recommendation. Proposed calls, a canceled lunch, and an unconfirmed video-call attendance were not recorded as completed encounters.

The existing introduction records now describe the meaningful introduction rather than incidental chat. Known participants share those records. A person only discussed in a referral does not count as direct contact. No additional people or speculative relationship edges were created.

Every profile was read back. All contact dates remained unchanged. Contact methods and affiliation records also remained unchanged. All 36 facts and 62 unique interactions link to retained sources. Repeated source-note, fact, and encounter creates returned their existing records instead of duplicates.

All 196 original message records were checked against the 46 saved conversations. The check normalized markdown formatting, links, and whitespace. It preserved the text, original UTC timestamps, record anchors, and three empty-message markers. The original export remains the source of record for attachments and other metadata.

## Sidebar regression and correction

The bulk source-note write initially filled the sidebar's Recent list. The user supplied a screenshot showing ordinary notes displaced by imported LinkedIn conversations. A dot path alone does not suppress a note from Recent. The agent should have checked this before creating the batch.

This did not require a new visibility feature. Collections already support `showRowsInRecent: false`. All 46 source notes were moved into [People Source Archive](https://notes.apps.byroni.us/collections/cmwd18duf048jqp21og1s84wk), with that flag disabled. Source notes remain available from People profiles and from the collection.

MCP readback confirmed the flag is false and the collection contains exactly the 46 imported notes. A profile and source note remained readable after the move. The current Recent query excludes rows in collections with that setting. The browser was not visually rechecked. The archive collection itself may appear once in Recent; its 46 rows are excluded. The original screenshot documents the regression before this correction.

## Code gaps, in recommended order

### 1. Employment status must be independent of dates

**Problem:** All 39 existing affiliations have unknown dates. A missing end date currently means current employment. This cannot represent an export listing of uncertain freshness, or an ended role with an unknown end date.

**Small change:** Add an explicit current/ended/unknown status. Preserve an unknown end date as unknown. Update current-role selection, organization member counts, profile labels, and MCP output together. Do not automatically mark existing undated roles current during a migration.

**Proof:** A past role with no known departure day displays as past. An undated export listing displays as unverified or unknown. Neither appears as confirmed current employment.

**Code:** `app/prisma/schema.prisma` (`PersonAffiliation`); `app/src/lib/people/schemas.ts`; `types.ts`; `app/src/server/people/profile-store.ts`; `organization-store.ts`; `app/src/components/people/AffiliationsSection.tsx`; `OrganizationView.tsx`; `app/src/server/mcp/people-format.ts` and `people-tools.ts`.

### 2. Employment records need partial dates and sources

**Problem:** A month-only date fails current validation. Historical messages supply observations such as a role started “about a month ago,” but cannot establish exact employment endpoints. Affiliations also lack an observation date and a source reference. Those claims remain sourced facts after cleanup.

**Small change:** Retain year/month/day precision and approximation, plus observed-on and source reference fields on the affiliation. Reuse existing note links for the source. Do not convert observation dates into hire or departure dates. Exact optional dates can remain supported; do not invent a general provenance framework for unrelated records.

**Proof:** A source can record a postdoctoral role that began approximately a month before an October message, without claiming an exact start day or current employment. Its source opens from the role in UI and MCP.

**Code:** Same affiliation model, schemas, stores, forms, and MCP tools as gap 1. Implement these two gaps together to avoid changing date semantics twice.

### 3. Career history needs a readable view and dated overlap retrieval

**Problem:** Profiles show a flat organization list. Shared-company leads compare organization IDs but ignore employment dates. They cannot answer who overlapped, when, or why an overlap is uncertain.

**Small change:** Show roles in a readable history, group related roles under their company where useful, and return overlap results with both roles and the supporting dates. Distinguish established overlap, possible overlap, and insufficient evidence. Shared employment remains a possible connection, not a confirmed personal relationship.

**Proof:** Fictional profiles include overlapping roles, separate periods at one company, a returning employee, and unknown dates. The UI and MCP produce the same explanation. No graph or relationship score is needed for this proof.

**Code:** `app/src/server/people/relationship-store.ts` (`possibleLeads`); shared People types; profile and organization queries; `AffiliationsSection.tsx`; `OrganizationView.tsx`; `NetworkView.tsx`; MCP relationship/organization reads.

### 4. Recurring MCP imports need registered identities and role reconciliation

**Problem:** The MCP profile writes used custom fields for source keys. They do not register `PersonExternalIdentity` records. Fact and interaction retry keys protect the same request, but do not reconcile equivalent records created under another key. Role additions have no equivalent per-record key. The CSV importer treats some different titles at one company as conflicts rather than a career history.

**Small change:** Expose the existing source identity mechanism to MCP ingestion and add a repeat-safe path for several source roles. Resolve roles by source identity and evidence, not company name alone. Preserve curated values and show conflicts. A small preview/apply helper is enough; a generic integration platform is unnecessary.

**Proof:** Import the same fixture twice with zero duplicate people, roles, facts, encounters, or source notes. A revised title preserves the earlier role when the source describes a promotion or a separate stint.

**Code:** `PersonExternalIdentity`; `PeopleImport` and `PeopleImportRow`; `app/src/lib/people/import-mapping.ts`; `app/src/server/people/import-store.ts`; MCP People tool registration and schemas.

### 5. Source ingestion must protect ordinary note navigation

**Problem:** The existing tools permit source retention but do not ensure that source-only notes are filed outside ordinary browsing. The agent's batch caused the visible sidebar regression.

**Existing fix:** Keep source notes in a collection with `showRowsInRecent: false`. That is configured for this batch. No new visibility field is required to repair it.

**Code follow-up:** Any future People ingest helper should resolve or create the source collection and disable row visibility before writing notes. Keep direct source links valid. Treat a missing archive setup as a preflight failure, not something to repair after a bulk write. Keep source retention reversible and do not delete evidence to clear the sidebar.

**Proof:** Start with ordinary recent notes, ingest a source batch, and confirm that it does not replace those notes with individual source rows. People source links still open. Test both UI and MCP entry paths that create import evidence.

**Code:** `app/src/services/recents/recents.queries.ts`; collection visibility settings; the future People ingest helper; MCP collections tools already expose the required setting.

## Remaining source limitation

The export still does not contain complete employment histories for these 40 people. The cleanup recovered dated career observations without inventing roles, employers, or dates. Better schema and views cannot supply unrecorded work history. Full-profile acquisition remains a separate decision.

## Next useful step

Shape one small employment slice around status, date precision, and role sources. Prove it with the recovered observations and fictional overlap cases. Keep the configured source archive in place and use it for any further ingestion.
