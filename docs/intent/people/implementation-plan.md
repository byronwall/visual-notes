---
title: "People — implementation plan"
slug: people
phase: plan
status: current
last_updated: "2026-11-11"
---

# People — implementation plan

## Plan at a glance

Build a small capture-and-recall loop before imports, reconnection, or graph rendering. Persist one person, a remembered fact, and a shared encounter. Prove the distinction between knowledge and contact. Then complete profiles, affiliations, and agent capture. Add import before population grows beyond a small curated set.

The recommended first release ends after Milestone 3. Milestones 4 and 5 deliver selected richer capabilities. They remain part of the intended roadmap, rather than prerequisites for the first useful system. Within Milestone 2, relationship entry is optional; the dedicated relationship model arrives in Milestone 5.

This plan uses GitHub `main` at `25c7a864947994b8f321ceab73e6b8eae14e3107`, inspected November 11, 2026. The local branch is `codex/audit-note-experience` at `dc18394ba91e991520a9b695412185ef30f92447`. It lacks current main's Collections, Places, Events, and MCP foundations. Do not recreate those systems on this branch. Preserve its uncommitted work, then choose a clean implementation baseline from current `main`. This planning task makes no branch change.

Open PRs #327, #298, and #212 contain research documents. Their returned file lists do not overlap the implementation modules below. Repeat this check before starting code. Existing local edits affect metadata and bulk actions; leave them intact.

The [shape brief](shape-brief.md) is the main scope review. This plan gives implementation detail. All names below are proposed additions unless marked as existing.

## Implementation strategy

### Source ownership and reuse

People owns person identity, remembered facts, encounters, affiliations, explicit connections, and reconnect state. `Doc` remains the owner of long-form note content. `TaskItem` remains independent. Use optional links where context helps, without mirroring People data into notes.

Current main provides these verified patterns:

| Existing source | Reuse and limit |
| --- | --- |
| `app/prisma/schema.prisma`: `Place` | Independent typed record with optional note; a better precedent than forcing each person to be a note. |
| Same schema: `Event`, `EventOccurrence` | Optional event context later. Events require a backing note; People should not. |
| `app/src/server/calendar/place-store.ts`, `event-store.ts` | Server store location and query/action separation. |
| `app/src/services/events/events.queries.ts` | `query()` functions that delegate to stores. |
| `app/src/server/mcp/tasks-tools.ts` | UI and agent writes share a store. |
| `app/src/server/mcp/tool-registry.ts`, `tools.ts` | Tool registration, scopes, annotations, refusal handling, and call logs. |
| `app/src/server/mcp/shared.ts` | Caller context, `appUrl`, named result lists, record lookup conventions. |
| `app/src/components/sidebar/nav-items.ts` | Central destination list, used by navigation and command discovery. |
| `app/src/server/collections/collection-store.ts` | Study field-editing patterns. Do not use collection rows as canonical People records. |

New code should use `app/src/lib/people/` for shared schemas and rules, `app/src/server/people/` for persistence, and `app/src/services/people/` for queries/actions. Put reusable UI under `app/src/components/people/`; routes only compose it. Do not create generic repositories, a new entity framework, or duplicated transport types.

### Proposed data model

All primary records use the app's identifier convention and creation/update timestamps. Use relations and ordinary queries before adding caches.

| Record | Minimum useful shape | Stage |
| --- | --- | --- |
| `Person` | `id`, `displayName`, `aliases[]`, optional summary/location/how-known text, `contexts[]`, `customFields` JSON, `archivedAt` | 1 |
| `PersonFact` | `personId`, short text, optional category, `learnedOn`, source label/URL/note ID, `retiredAt` | 1 |
| `Interaction` | `occurredOn`, kind, summary, source label/URL/note ID, optional retry key, `archivedAt` | 1 |
| `InteractionParticipant` | Composite key `(interactionId, personId)`, `countsAsContact` | 1 |
| `PersonContact` | `personId`, kind, label, original value, conservative match value | 2 |
| `Organization` | Name, optional kind/summary/URL, optional backing note, archive timestamp | 2 |
| `PersonAffiliation` | Person, organization, role, optional start/end dates | 2 |
| `PersonDocLink` | Unique person/note pair for deliberately linked context | 2 |
| `PersonExternalIdentity` | Person, source namespace, stable external key, last import date | 3 |
| `PeopleImport` | Source, file hash, applied time, row outcomes and affected IDs | 3 |
| `PeopleReconnect` | Person, reason, source fact/interaction reference, suggested day, status, snoozed-until, stable suggestion key | 4 |
| `PersonRelationship` | Source person, target person, type, source, optional start/end dates, archive timestamp | 5 |

The first proof needs only four models. Add later models when their workflow exists. Do not add empty future tables.

**Facts and custom fields:** Use facts for short, dated or sourced assertions. Use custom fields for user-named profile attributes with simple scalar values. Start with key/value editing and bounded JSON. Do not require a field-definition designer. Keep current role on an affiliation when known; avoid a competing `Person.companyId` or duplicated canonical job history. Unstructured professional background can remain a fact or short summary.

**Dates and recency:** Store encounter days and learned days as calendar dates, not fabricated midnight instants. Keep creation/update timestamps separate. PostgreSQL distinguishes `date` from timestamp types ([date/time documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)). Use `America/Indiana/Indianapolis` to interpret “today” at capture; do not let browser timezone conversion shift the stored day. Reject impossible dates and future encounters. Unknown historical dates remain unknown rather than becoming the import date.

Compute latest recorded contact from active interactions with `countsAsContact=true`. Facts, imports, profile edits, referrals about someone, and future suggestions do not advance it. Recompute correctly after editing participants, moving an encounter date, or archiving an interaction. No recorded contact is unknown history, not proof of no relationship. Do not add a stored recency cache before measured need.

**Identity:** Names and organizations are not globally unique. Match exact source identity first. Email, phone, and profile URLs provide candidates, not unconditional merges. Shared family phone numbers and inboxes must remain possible. A contact value can belong to several profiles. Preserve source values; normalize only enough for the specific contact type. Do not guess phone country codes or strip meaningful URL path segments.

**Relations and retention:** Enforce a unique participant pair and unique source namespace/external key. Add indexes for participant person ID, encounter day, fact person ID, external identity, and affiliation lookups. Choose name search indexes after measuring the real query; a plain B-tree does not solve arbitrary substring search. Archive people and interactions for routine removal. Agent tools do not permanently delete data. Archiving a person preserves shared encounters for the other participants.

### UI composition and mockup interpretation

Add `/people` to the current destination list and command palette. Use `/people/[id]` for a durable profile. Later add `/people/organizations/[id]`, `/people/reconnect`, and `/people/network`. Directory search, filters, page, and selected preview should survive refresh through URL state. A row can select a preview while the person's name is a normal profile link. Browser Back restores the directory state.

The directory uses dense rows: name, useful affiliation, contexts, and last recorded contact. Add next-reconnect only when that workflow exists. An empty name search shows a clear create action; other empty filters offer clear reset actions. Missing data uses a neutral empty value. Do not fill space with completion scores. Use server-backed pagination and bounded results; measure with 2,000 fictional people before adding virtualization.

Profiles put current “What to remember” facts first. Place contact methods and affiliations in a secondary column on wide screens. Put a labeled, newest-first history below. A fact entry uses its learned or recorded date; an encounter uses its actual day. Distinguish those labels. Inline edits fit names, roles, and short attributes. Retired facts remain available in history without competing with current facts.

Global capture offers **Remember a detail** and **Log interaction**. Profile entry preselects the person. Remember requires one person and text; interaction requires at least one participant, a day, kind, and text. Default direct encounters to contact participants. Referral/recommendation capture must distinguish a person spoken with from a person discussed. Category, source, and notes are optional. Keep one save action, focus the text field when the person is known, and return focus after save or cancel.

Retain typed drafts on error. Do not close a nonempty dialog through a backdrop click. Provide visible row hover, separate nested-control hover, keyboard access, and anchored portalled menus. On narrow screens, use the same data and route components with CSS layout changes; mount page children once. Keep primary controls SSR-rendered. Use `query()` plus `createResource()` and prefer `.latest` during revalidation. Writes use server actions.

All five source mockups were visually inspected. Retain the directory preview, facts above profile history, two capture modes, quiet reconnect rows, and focused network. Omit their decorative “Ask the agent,” global Undo, connection-count columns, and repetitive pills until useful behavior supports them. Remove the capture mockup's optional Private toggle: storage is private by default. Mockup January 2025 dates and fictional contacts are not requirements. The ZIP design specification was not downloaded; do not claim its text was reviewed.

### Agent contract

MCP is a first-release interface for discovery and maintenance, with the same rules as the UI. Read/search and writes ship together in Milestone 2. Creating data without being able to discover, inspect, and correct it is incomplete.

Use this proposed tool surface. Names can follow existing registry conventions; the capabilities are required.

| Capability | Proposed tools | Required behavior |
| --- | --- | --- |
| Discover people and remembered context | `people_search` | Search names, aliases, contacts, facts, encounter text, and affiliations. Filter by context, organization, archive state, and recorded-contact window. Show why a result matched. |
| Read one person | `people_get` | Return profile, contact methods, current facts, affiliations, linked-note references, and bounded history. Page longer sections. |
| Search memory entries | `people_query_facts`, `people_query_interactions` | Filter by person, text, category/type, date range, and active/retired state. Return source references and participants. |
| Discover and inspect organizations | `people_query_organizations`, `people_get_organization` | Find organizations and read their details, members, roles, affiliation history, and note references. |
| Create and maintain profiles | `people_create`, `people_update` | Create people; patch identity, summary, contexts, custom fields, contacts, affiliations, and note associations. Give nested records stable IDs for later edits. |
| Append and correct memory | `people_add_fact`, `people_update_fact` | Append a separate sourced fact; correct or retire a specific fact without replacing the profile's memory. |
| Log and correct encounters | `people_log_interaction`, `people_update_interaction` | Append one encounter with shared participants; correct its date, type, summary, participant set, or archive state. Apply contact-recency rules. |
| Maintain organizations | `people_create_organization`, `people_update_organization` | Create/update organization fields and note association. Person affiliation changes use `people_update`; both paths share one store. |
| Archive and restore | `people_update`, `people_update_organization` | Set or clear archive state explicitly. Retain history; do not permanently delete through MCP. |
| Inspect import duplicates | `people_find_duplicates` | Milestone 3: return candidates and matching evidence. Manual merge remains a UI action initially. |
| Read and maintain reconnection | `people_list_followups`, `people_update_followup` | Milestone 4: read reasons/context; create explicit prompts; snooze, dismiss, resolve, or correct them. Return on-demand digest data. |
| Read and maintain relationships | `people_query_relationships`, `people_update_relationship` | Milestone 5: create, correct, archive explicit typed edges; inspect sourced connections and bounded possible paths. |

Append means adding a fact or encounter record. It does not mean concatenating text into a person's summary or replacing a history array. Profile updates distinguish omitted fields from explicit clearing. Contact, affiliation, and note-link operations identify the exact nested record or association to add, update, or remove. Removing an affiliation association is distinct from recording its historical end date.

Register tool descriptions, schemas, read/write annotations, and examples so clients can discover their purpose through normal MCP tool listing. Extend existing cross-area `search` to include permission-appropriate People hits, with a path to `people_get`. Do not require an agent to know a person ID before searching. A dedicated People tool then provides richer filters and records. Do not add a redundant custom tool-listing endpoint.

Search and query results use bounded named lists, stable IDs, match context, and `appUrl`. Paginated results include a continuation cursor and a clear indication that more records exist. Keep large histories out of default search responses. Writes return affected IDs, a concise change summary, and links; clients can read back the saved record. Never report a proposed write as saved.

Use explicit IDs for writes after lookup. Ambiguous references return candidates and write nothing. Add source information for agent-created facts and interactions. An optional request key prevents duplicated creation when an agent retries the same operation. Store and enforce it in the same transaction as the write. Repeated text alone is not a safe identity key.

All writes call the same validation/store functions as the UI. Fact and encounter correction, organization access, and nested profile updates belong in the first release. Duplicate inspection arrives with imports; reconnect and relationship tools arrive with those workflows. Agents can create the records and prompts selected by Byron, but cannot invent unsupported facts, turn shared membership into acquaintance, or send outreach.

The registry currently uses `notes:read` and `notes:write` for all feature families. Reuse that convention rather than silently adding per-field permissions. Adding People tools means existing broadly scoped clients can gain People access. Test and disclose that behavior when registering the family; private storage does not mean hidden from authorized agents. Ensure public note/share outputs never expand People links or facts. Source a linked note without editing user-authored note text, consistent with existing MCP rules.

### Local loop and dependency proof

No app or database writes ran during this planning task. The local `.env` points to a non-loopback or unresolved host. Disposable data was not established. Do not run existing browser suites or migrations against that target.

Milestone 1 first adds a small deterministic capture session with fictional records. Its fixture page must be development/test-only. A proposed `pnpm test:people` command should run focused capture rules; it does not exist yet. The command becomes the fast loop once implemented: `pnpm --dir app test:people`. This proves person resolution, participant rules, date rules, and recall with deliberate save errors. Keep the substitute small; do not build an adapter framework.

Then point the same People store at a disposable loopback PostgreSQL database. Add a guarded `pnpm test:people:db` command which refuses non-loopback targets and requires a dedicated test database name. Use the repository's current audit database tooling after inspecting it on the implementation baseline. The older checkout's Compose file is not evidence of a safe data target. Use the application's pinned Prisma client and existing `$transaction` pattern; current public Prisma documentation describes a newer major version and must not dictate this app's API.

Prove constraints, multi-write rollback, import matching, retry keys, and date round trips with the real database. Small deterministic rule tests do not prove PostgreSQL behavior. Run authenticated browser flows only after the disposable target is confirmed. Use Chrome's required mock-keychain/basic-password-store flags when launching it directly. A later connector smoke test proves real OAuth scopes and tool serialization. It does not need LinkedIn, email, calendar, or a new LLM provider.

Deployment and production migrations require a later explicit request. Additive models and isolated navigation/tool registration provide a simple rollback: stop exposing People, retain saved records, and fix forward. Do not remove tables to roll back a UI change.

## Milestone 1: Capture a detail and recover it

Build one profile, two capture modes, and detail search with 25–50 fictional people. Start in the isolated fixture session. Then implement the four core models and persist through a People store once the disposable database is established. Generate migrations with Prisma CLI against that test target. No production data migration is needed.

Change `app/prisma/schema.prisma`, add `app/src/lib/people/`, `app/src/server/people/`, `app/src/services/people/`, profile/capture components, and thin People routes. The initial directory can be minimal. Keep global navigation hidden until persistent behavior passes.

Test that a fact leaves contact recency unchanged; a two-person encounter appears on both profiles; a discussed third party does not gain a last-contact day. Edit and archive the latest encounter and verify recency changes correctly. Inject a save failure and check draft retention. Verify impossible dates and unknown people produce a clear refusal. Reload against the disposable database and search by a remembered detail.

### Desired end state

- A person, fact, and shared encounter survive reload and are easy to retrieve.
- The fixture proof and real database proof have separate recorded results.
- Capture supports useful recall without note duplication; simplify it if the first proof fails.

## Milestone 2: Use profiles across life contexts and agents

Complete the directory, contact methods, organizations, affiliations, custom fields, related notes, and the first-release MCP surface specified above. Include search/read, profile and organization maintenance, fact append/correction, encounter log/correction, and archive/restore. Add the People destination and global capture command. Keep organization kinds generic while making company pages useful first. One person can have overlapping affiliations, including past roles. A compact organization page lists members and links to its optional long-form note.

Change the new People modules; `app/src/components/sidebar/nav-items.ts`; `app/src/components/command-palette/palette-commands.ts`; add `app/src/server/mcp/people-tools.ts`; register it in `app/src/server/mcp/tools.ts`. Add a People section to cross-area search only through its existing permission-aware path; inspect that implementation before changing it.

Verify exact-name collisions, aliases, shared phone numbers, optional fields, several affiliations, source links, and archived profiles. Discover the tools through MCP listing, find a person without a known ID, search by a remembered fact, and page through encounter results. Confirm cross-area search leads to the full People record.

Use one agent round trip: create a person, add a contact and affiliation, append a fact, log a shared encounter, read them back, correct the fact and encounter, then archive/restore the profile. Verify unrelated fields remain unchanged and contact recency follows the corrected encounter. Repeat the request key and observe no duplicate. Test read-only scope refusal for every write family and unauthenticated refusal for private reads. Verify public shared-note output excludes People data.

Run the browser smoke at wide desktop and narrow widths: directory selection, full profile link, Back, refresh, nested controls, capture focus, failed save, inline edit, menu placement, and no hydration errors. Use 2,000 fictional people to measure search, page size, and payloads. Use the proposed 15-second recall target as a usability check, not a fabricated result.

### Desired end state

- Profiles replace loose notes for a small trial set. MCP clients can discover, read, search, create, update, append, log, and correct records using the UI's rules.
- Organizations expose useful context without becoming inferred personal relationships.
- Navigation, search, and sharing boundaries work before import increases the data volume.

## Milestone 3: Populate and reimport without losing curation

Add CSV upload, field mapping, preview, duplicate candidates, and an explicit apply action. Parse files on the server through a narrow import function. Support one representative format first; generic column mapping handles common contact exports. Do not add provider-specific automatic synchronization. Preserve original source labels and stable row keys when supplied.

The preview shows create, unchanged, proposed update, conflict, and invalid outcomes. Source identities match repeat imports. If no stable key exists, show candidates and require a mapping choice. Similar names never trigger automatic merges. Existing nonempty curated profile values win by default; show imported disagreements rather than overwriting them. Empty import cells do not clear data. Imports add missing contacts and affiliations conservatively. Keep external identity separate from editable profile links.

Persist applied row outcomes so a partial import can resume. Commit each person's related changes atomically; do not hold a long transaction around the whole upload. A retry skips successful source rows and retries failures. A source key attached to different canonical people is a conflict. Reparse/revalidate on apply so a stale preview cannot overwrite intervening edits.

Provide manual merge review: choose the surviving person, resolve profile conflicts, move facts, contacts, affiliations, links, participants, and identities, then archive the duplicate in one transaction. Deduplicate participant pairs when both people were in one encounter. Do not silently merge conflicting facts. Run this before reconnect and relationship tables exist; later stages must extend merge handling.

Change the People schema/store/UI/tool modules plus focused import fixtures. Test a 500-person file twice, a curated edit between runs, two same-name people, shared contact values, an invalid row, a changed source key, and a failed row followed by retry. Verify exact counts and preserved values rather than screenshot appearance alone.

### Desired end state

- Hundreds of profiles can be added with a reviewable import result.
- Repeat imports produce no duplicate source identities or silent curated-data loss.
- Duplicate resolution preserves encounters and profile context. This ends the recommended first release.

## Milestone 4: Surface useful reasons to reconnect

Add People-owned reconnect records and `/people/reconnect`. Use deterministic rules before any generated suggestions. Recommended initial policy: per-person opt-in for elapsed-time suggestions, with contextual prompts created from explicit user/agent input. Imported strangers remain quiet. No recorded contact does not mean overdue.

Start with pending, snoozed, dismissed, and resolved states. Each suggestion has a reason, source context, suggested day, and stable key. Snooze changes visibility; dismiss suppresses that specific suggestion; resolved records a deliberate action. None of these actions implies contact. Logging a new direct encounter resolves applicable old elapsed-time prompts. A dismissed contextual prompt does not reappear simply because the page refreshed.

Compute due candidates on read and persist only actionable suggestion/state records. Avoid adding a background queue or scheduler for this first view. Extend person archive and merge rules to handle reconnect state. Add agent list/update tools and an on-demand digest backed by the same query. The digest can be deterministic text with links; an LLM is not needed to prove it.

Verify fixed-clock scenarios for snooze boundaries, dismissal, new contact, archive, merge, and repeated candidate generation. Review a small set of sample suggestions with Byron before enabling broad elapsed-time generation. Frequency and delivery channel remain a later product choice. Scheduled delivery needs a separate transport/scheduling decision; no automation is created by this plan.

### Desired end state

- A focused queue gives understandable reasons to reconnect, without adding Tasks.
- Snooze and dismissal persist; facts and resolved prompts cannot fabricate contact.
- The digest reflects the same eligible records and provides direct profile links.

## Milestone 5: Explore known relationships and possible introductions

Add typed relationship entry to profiles before rendering a network. Model directed relationships such as mentor-to-mentee separately from symmetric ones such as friend or spouse. Normalize symmetric endpoint order to avoid duplicate edges. Refuse self-edges. Preserve source and optional dates. One person may have several distinct relationship types with another.

Add a focused network around one selected person, with a bounded one/two-hop view and a list alternative. Distinguish person connections from organization membership. Reuse existing pan/zoom or layout code only after a short fit check; UMAP proximity and note-link graphs are not relationship evidence. Avoid a whole-network visualization of all 2,000 people.

Introduction-path lookup traverses active explicit person connections. Shared affiliation can show a separate possible lead, but cannot complete a confirmed path. Show each edge's type and source so “possible” remains clear. No path means no recorded path, not proof that an introduction is impossible. If paths start from Byron, store an explicit self person record; do not infer a connection to every imported profile.

Extend merge handling for relationship endpoints and duplicate edges. Verify a known short path, a shared-employer-only false path, directed edges, archived people, cycles, and no path. In the browser, check readable edge labels, selection, fitted view, stable pointer-centered zoom, full-viewport expansion, and keyboard-accessible list navigation.

### Desired end state

- The network helps answer who is connected and why, without presenting guesses as facts.
- Possible introduction paths are supported by visible relationship records.
- Profile entry remains useful even when the graph is hidden.

## Cross-cutting verification

After sizable implementation changes, run `pnpm lint` and `pnpm type-check` in `app/`, plus focused rule/database tests. Run browser checks for each changed route and overlay against confirmed disposable data. Capture UI proof under project `tmp/` for each UI PR. Keep tests for identity, contact recency, shared encounters, import preservation, and privacy boundaries; skip tests that only mirror component structure.

Log operation outcomes with a consistent `[people]` prefix. Use existing activity/call-log facilities for who changed a record. Do not put private fact text, raw imports, or contact values in routine logs. Audit logging is separate from interaction history and does not imply a universal undo feature.

## Open decisions and spikes

1. **Safe local baseline:** Before code, inspect current main's audit database tooling and establish a disposable loopback target. Output the guarded start/test command. Fallback: fixture-only UI/rule proof; defer persistence/browser writes.
2. **Reconnect eligibility:** Before Milestone 4, validate opt-in suggestions and threshold choices with sample data. Default: quiet imported profiles, explicit contextual prompts.
3. **Voice gap:** After the capture trial, test device/agent dictation. If it fails the needed workflow, inspect current main's `DocAudio` capture path. Add in-app recording only for a proven gap; otherwise keep text capture.

## Below the cut line

Automatic LinkedIn/profile synchronization, email/calendar ingestion, provider enrichment, sales pipelines, action-item extraction, meeting transcription, automated outreach, relationship-strength scoring, a native mobile app, public People profiles, per-field permission systems, generic entity graphs, and an organization CRM remain outside this plan. Pre-meeting briefings were offered but not selected. Scheduled digest delivery follows the on-demand digest only when its channel and frequency are chosen.

The original [research conversation](https://chatgpt.com/c/6af46f53-d8f4-83e9-80f5-93b3d3d5d42f) contains all 15 answers, assistant proposals, and five mockups. User answers set intent; assistant proposals and images inform this recommendation without becoming accepted requirements.
