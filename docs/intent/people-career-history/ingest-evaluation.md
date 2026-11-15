# People ingestion evaluation

Evaluated November 11, 2026. Read all 40 active People profiles through MCP and compared them with the local LinkedIn export. This was a dry run. No live profile, note, fact, or interaction was changed.

**Finding:** All 40 profiles can become more readable and better sourced without application changes. The existing system can hold useful facts, encounters, contact methods, and source notes. It cannot yet represent the available career evidence faithfully as dated employment history. That is the first necessary code boundary for the requested experience and overlap view.

## What the audit found

| Measure | Current result | Meaning |
|---|---:|---|
| Profiles inspected | 40 | All active profiles, with complete returned interaction pages |
| Facts | 18 across 18 profiles | 22 profiles have none |
| Interactions | 40 | Exactly one per profile; not a reconstructed history |
| Employment affiliations | 39 | All lack start and end dates |
| Linked notes | 0 | Source text sits in summaries or local files |
| Missing how-known fields | 20 | Existing connection dates and exchanges can supply context |
| Contact methods | 40 URLs, 7 emails, 4 phones | No missing self-reported email or phone found by the sender-based extraction check |
| Source message records | 196 unique; 193 with text | 212 person/message associations, including shared threads and three empty records |
| Source conversations | 46 | Shared conversations should be retained once and linked to each relevant profile |
| Profiles with incomplete message text in summaries | 12 | Local original messages can restore complete text; do not reconstruct from truncated summaries |

The source has 115 distinct conversation/day groups. This is an inspection count, not a target interaction count. Scheduling, greetings, and substantive discussions need different treatment. A discussion can span several days, and a planned meeting may never occur.

Two profiles have later group-thread activity than their stored contact dates. These are review cases, not established date errors. A recipient list does not establish direct contact with every person. Blank messages also must not advance recency automatically.

Additional sources contain five matching invitations, ten received endorsements, five given endorsements, and one received recommendation. Invitations often repeat messages and omit timezone information. Received endorsements describe Byron's skills. They must not become the endorser's skills. The recommendation's name match needs corroboration; the message archive supplies that in this case.

The connection export supplies one company/title listing per person. Its Positions file describes Byron's own nine roles. Neither supplies full career histories for these 40 people.

## Fields needed

Use the existing records where their meaning fits. Do not add a general evidence platform to perform this cleanup.

| Record | Minimum useful fields | Existing support and limit |
|---|---|---|
| Person | Name, short summary, how known, contexts, source profile identity | Supported. Keep the summary to useful human context, usually one or two sentences. |
| Contact | Kind, value, label, source and observation date | Kind/value/label exist. A dated label and linked evidence can suffice for this batch. Validity periods are not structured. |
| Employment | Company identity, role, start/end values and precision, current/ended/unknown status, observed date, source reference | Company/role and exact optional dates exist. Partial dates, independent status, observation date, and role-level source references do not. |
| Fact | One useful claim, category, date learned, source | Supported. Put historical timing in the claim when it differs from the date learned. Do not make old ages or locations appear current. |
| Encounter | Event day, type, participants, contact flags, brief description, source | Supported for confirmed encounters with known days. Do not record proposed meetings as completed. Exact times are unnecessary for this evaluation. |
| Source conversation | Stable source key, participants, original timestamps, original text, source record anchors | Linked notes can hold this now. Notes are retained evidence, not the main profile summary. |
| Import identity | Source namespace and stable external profile key | The database has registered identities for CSV import. MCP profile writes do not expose registration of those identities. A custom field is only a breadcrumb. |

For employment, retain a month as a month. Keep “about a month earlier” as approximate evidence. Missing end date must not mean current employment. A source observation is not a hire date or departure date.

Source and temporal fields matter before automatic overlap. A company listing observed in an export does not establish an employment interval. Even a complete period establishes shared employment, not a personal acquaintance.

## How far existing tools can improve the 40

**Readability:** Forty candidate summaries contain 3,313 characters in total, compared with 65,902 now. This is about 95% less summary text. The reduction moves evidence out of the summary; it is not a proposal to discard it. The candidates need ordinary editorial review before application.

**Source retention:** Prepare 46 conversation notes and 48 profile links. Retain each shared conversation once. Original UTC timestamps and record anchors remain available. Keep the original export as the source of record; preserve attachments and metadata there even if a note displays only the conversation text. Re-read notes before removing any summary text.

**Structured memory:** Seventeen reviewed new fact candidates across 15 people fit the current fact schema. They include employment observations, work descriptions, a historical location, and a stated colleague relationship. This would raise the fact count from 18 to 35 before any consolidation. It is a conservative candidate set, not a completeness score. Split existing facts that mix several periods instead of adding duplicate versions.

**Context and contacts:** Fill the 20 missing how-known fields. Merge export/source metadata into custom fields while preserving other values. The contact audit found no additional self-reported methods; useful work here is linking evidence and retaining old dates. References to another person's email, generated email patterns, and Byron's signatures must not become the profile owner's contact methods.

**Encounter history:** The archive supports additional message episodes and confirmed calls. For example, a thank-you referring to a call “yesterday” supports a completed call on a different day from the follow-up message. Other records only schedule calls. Review episodes before writing. Do not turn 196 rows into 196 encounters or advance contact dates from group membership alone.

**Past work:** Preserve the recoverable observations as sourced career facts now. Do not add undated historical affiliations that the UI would label current. Several messages name earlier employers, but often omit titles and both endpoints. Some describe work at an unnamed employer. Full career history remains a source-data gap even after code changes.

## Ingestion process

1. Snapshot current profiles through MCP. Retain record IDs, source data, and the before values for every proposed edit.
2. Match people by the normalized LinkedIn profile URL. Use names as corroboration. Resolve company names explicitly; do not merge acronyms, renamed organizations, or people based on a guess.
3. Read the original CSV records. Preserve UTC timestamps. Convert message dates to the People timezone for dated interactions. Do not assume a timezone for other files.
4. Group by original conversation, then identify real episodes. Read later corrections and cancellations before extracting claims. Resolve the speaker and the subject separately.
5. Retain source notes with deterministic retry keys. Link relevant profiles and verify saved content. Use source note IDs plus record references for facts and encounters.
6. Prepare separate changes for profile context, contact methods, facts, encounters, and employment evidence. Each claim carries its own timing and source. Hold unsupported employment periods aside.
7. Compare proposals with existing records. Reuse or correct existing facts and interactions. Use stable request keys for new facts and encounters. Read-before-add for affiliations and contacts; those additions lack equivalent per-record retry keys.
8. Apply one representative profile and verify source preservation, search, recency, and repeat execution. Then process the rest through MCP in small batches. Apply summary cleanup last.

Maintain a local manifest mapping each source claim to its resulting record ID. A second pass must propose zero duplicate additions. Existing request keys protect a repeated identical create; they do not reconcile an older record made with a different key. Detect those by source and meaning before writing.

For this fixed 40-person repair, this manifest and existing tools are enough. For continuing unattended imports, expose registered source identities and role upsert behavior through MCP rather than relying on custom fields and repeated scans. Preserve before values and created record IDs so a failed repair can resume or be reversed.

## Evaluation cases and results

The local probe used the actual People input schema. Its file hash matches the inspected `origin/main` schema. Seven cases confirmed the following boundaries:

- Short summaries, how-known context, and linked-note changes validate.
- Sourced historical facts and completed dated encounters validate.
- Exact dated role records validate.
- A month-only employment date fails validation.
- An unknown-ended role has no supported status field. The local schema strips proposed status and source fields, leaving an undated role. Current UI semantics then label it current.
- A proposed external identity on a profile patch has no supported field. The local schema strips it.

All 40 candidate profile patches and all 17 fact payloads pass those validators. This proves input shape only. It does not prove note existence, database persistence, live MCP acceptance, UI behavior, or live replay. Unknown arguments may also be rejected before reaching the local schema. No live write test ran.

Source review also identified mandatory negative cases:

| Case | Required treatment |
|---|---|
| Later message reports an account was hacked | Reject the earlier introduction as relationship evidence. |
| A lunch is explicitly canceled | Do not create a completed lunch encounter. |
| A phone or video call is only scheduled | Retain the plan in the source; do not mark attendance. |
| A message says people are waiting for Byron to join | Do not infer that he joined. |
| Sender's signature contains Byron's email or phone | Do not assign it to the recipient. |
| Another person's email is guessed from a naming pattern | Do not import it as a verified contact. |
| A group thread appears under two imported people | Retain one source and shared encounter where warranted, not duplicate events. |
| A message reports a job application | Do not create employment at that company. |

## Where code becomes necessary

**First: honest employment records.** Add current/ended/unknown status independent of an end date. Preserve date precision and approximation. Add an observation date and source reference. Correct current-role and organization-member display rules together. Do not backfill exact dates from observation dates.

**Second: useful overlap retrieval.** Compare role periods at the same resolved organization and return the supporting roles and dates. Keep known overlap, possible overlap, and insufficient evidence distinct. Apply the same rules in UI and MCP. Existing shared-company leads do not compare dates. A graph is not needed for the first proof.

**Third, for recurring import:** Expose registered source identities and repeat-safe role writes through MCP. A one-off correction can use a manifest today; durable reimports need a supported write path that retains several roles rather than treating a different title at one company only as a conflict.

No system change can supply unrecorded career history. Acquisition of full profiles is a separate decision and proof. No scraping, provider integration, migration, or new people import was performed during this evaluation.

**Recommendation:** Perform the bounded source/fact/summary repair first, keeping career observations as facts. Use that cleaned data to prove the smallest employment-model change and a simple overlap list. Do not delay every improvement for a full importer rewrite, and do not claim the no-code repair delivers a reliable career timeline.
