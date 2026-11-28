---
title: Event tool selection and repair
origin: repo-reading-brief
topic_id: visual-notes.event-tool-selection-and-repair.v1
source_edition: 2026-11-18
source_edition_url: https://chatgpt.com/space/page_0dccc30b35d881918b6c2a5097e86486
status: research-proposal
---

# Event tool selection and repair: proposed evaluation

- Origin: repo-reading-brief
- Source edition: [November 18 2026 Better choices and smaller explanations](https://chatgpt.com/space/page_0dccc30b35d881918b6c2a5097e86486)
- Stable topic ID: `visual-notes.event-tool-selection-and-repair.v1`
- Assistant-generated research artifact: exclude this document, branch, PR, commits and derivative research merges from substantive-activity ranking.
- Status: research proposal; no model evaluation executed; no application behavior changed.
- Inspected baseline: `af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90`.
- Scope: documentation only. No production fixtures, implementation edits, migration, deployment, or merge.

## Reading and limits

[Ken Aizawa, Writing effective tools for agents — with agents](https://www.anthropic.com/research/writing-tools-for-agents), Anthropic, September 11, 2025, is practitioner guidance. It recommends realistic task evaluations, useful outputs and trace inspection rather than treating a callable API as sufficient. It supports testing the decision surface here; it does not prove that this patch improves any particular client or model.

## Current evidence and ownership

[PR354](https://github.com/byronwall/visual-notes/pull/354) describes ordinary collection-row writes that preserved dates in prose but did not create event records. It is merged; this document does not verify deployment.

Pinned source owners:

- [collections-tools.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/collections-tools.ts): collection instructions, schema-level event counts and post-write repair notices. `plainRowNotice` requires existing event rows; `collections_get` includes event guidance only for nonzero event count.
- [collections-agent.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/collections-agent.ts): row serialization adds `event` only when event columns are present. Do not describe `event:null` as universal.
- [event-tools.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/event-tools.ts): event instructions, duplicate review, unknown-time handling and event-tool schemas.
- [event-read-ops.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/event-read-ops.ts): event absence refusal with repair direction, and duplicate-check recommendations.
- [event-tools.test.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/event-tools.test.ts): SDK contract tests with fake persistence and explicit tool calls.
- [collections-tools.db.test.ts](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/src/server/mcp/collections-tools.db.test.ts): real-database tests, also explicitly naming tools.
- [mcp-connector.md](https://github.com/byronwall/visual-notes/blob/af1f67ae3f3f11d1215c1fb75a6eec3a3f986d90/app/docs/mcp-connector.md): transport, logging, smoke and database-test conventions.

These checks do not test autonomous selection from natural-language intent. That is a bounded observation about the inspected tests, not a claim that the entire repository lacks evaluations.

## Hypothesis, not result

The count-gated guidance may help repair rows in established events collections more than it helps the first event in an empty or all-plain collection. Misleading dated examples may outweigh generic guidance. A client omitting server instructions may behave differently even with identical handlers.

## Proposed fixture matrix

Use synthetic names and fixed absolute dates, with no real contact, event booking or external calendar side effects. Run only in a disposable database under existing test conventions.

| Fixture | User intent and initial state | Expected saved outcome |
|---|---|---|
| First event | Save a meetup to an empty collection | One event note, supplied show date, collection membership |
| Mixed collection | Same request, one event and one plain row | Correct event; unrelated plain row untouched |
| Misleading examples | Same request, all existing rows have dates only in prose | New item is an event despite exemplars |
| Repair | Fix missing event date on an identified plain note | Same note ID becomes event; body preserved |
| Duplicate | Save an event already present | Existing event reused; no duplicate note/show |
| Date-only intent | Record when a book was finished | Plain reading-log row, not an event |
| Unknown clock time | Meetup date known, start time absent | No invented confirmed midnight |
| Read-only scope | Same creation request without write permission | No mutation; final answer states blocker |

Treat full server instructions versus tool-descriptions-only as separate client-visibility conditions. Keep schemas and persistence constant. Do not deliberately hide tools while claiming to test description quality. A later ablation can remove the collection-response hints alone; label it experimental, never deploy it.

## Receipts and scoring

Record baseline commit, model/client versions, prompt fixture ID, visible tool catalog, instructions actually delivered, call trace, request IDs and persisted before/after IDs. Use existing MCP action logs where applicable. Redact secrets and unrelated user content.

Judge independently:
1. Domain outcome: correct note/event/show identity, collection, supplied local date/time zone, and no duplicate.
2. Recovery: same note ID retained and no collateral body edits.
3. Verification: a readback confirms event details before asserting completion.
4. Reporting: no false claim of external-calendar updates or RSVP.
5. Efficiency: calls, retries and latency, only after correctness.

Allow semantically correct alternative tool sequences. A repair using event-update plus add-shows is not a failure because it differs from new-event creation. A successful write response or persuasive final sentence is not sufficient evidence.

Use held-out paraphrases and report numerator/denominator by fixture and visibility condition; do not present a small pilot as a reliable population success rate. Freeze evaluation cases before tuning descriptions. Model calls require separate execution planning and budget; this document authorizes none.

## Decision rule and follow-up

If only tool-descriptions-only runs fail, inspect actual client instruction delivery before rewriting handlers. If misleading exemplars fail across clients, investigate discovery outputs. If repair notices are seen but ignored, study their placement and explicit identity-preserving repair path. If negative controls become events, narrow overbroad date-based guidance.

Do not change tools based on this proposal alone. First publish the fixture results and traces, then choose the smallest observed remedy. This adds a decision/recovery experiment to existing deterministic contracts, rather than duplicating their coverage.


## Deduplication and validation

The reading history and all-state daily-brief PR search were inspected November 18; no matching event-selection protocol was found. Existing #212 lifecycle research, #298 transcription seams and #327 semantic read dependencies retain their separate scopes. Branch and all-state topic searches were repeated immediately before publication. This packet follows the existing docs/research daily-brief convention.

Repository guidance, primary article, relevant implementation, tests and MCP documentation were read. No application tests, browser checks or proposed model experiment were run. Remote content and changed-file scope are checked after publication; CI results belong to that exact documentation commit, not to the research hypothesis. No agent guidance changes are proposed.
