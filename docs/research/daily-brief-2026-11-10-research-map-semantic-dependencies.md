---
title: Semantic read dependencies for research-to-map edits
origin: repo-reading-brief
topic_id: visual-notes.research-map-semantic-read-dependencies.v1
source_edition: 2026-11-10
source_edition_url: https://chatgpt.com/space/page_4c19cd6be4c881919526c3debf83fe74
status: research-proposal
---

# Semantic read dependencies for research-to-map edits

Assistant-generated research; origin: `repo-reading-brief`; stable topic ID: `visual-notes.research-map-semantic-read-dependencies.v1`.

Source edition: [November 10, 2026 daily repo reading brief](https://chatgpt.com/space/page_4c19cd6be4c881919526c3debf83fe74). Exclude this document, its branch, PR, commits and derivative research merges from future substantive-activity ranking. This is a documentation-only investigation proposal, not application implementation or authorization to implement it.

## Scope and decision

What must still be true about the research and map an agent read before its delayed answer can become new cards? Investigate one bounded operation: **Add findings to map**, introduced by merged [#326](https://github.com/byronwall/visual-notes/pull/326). Keep its existing additive edits, source links, locked writes, revisions and undo.

The proposed deliverable is a dependency worksheet and a deterministic interleaving protocol. It separates three properties: preserving concurrent writes, binding source numbers to the evidence the model saw, and deciding whether a suggestion based on older context may still be accepted. No concurrency defect, incorrect citation in use, or deployed behavior has been reproduced. The protocol below has not been run.

## Reading and transferable idea

Primary source: FoundationDB, [Developer Guide: Conflict ranges](https://apple.github.io/foundationdb/developer-guide.html#conflict-ranges) and [Snapshot reads](https://apple.github.io/foundationdb/developer-guide.html#snapshot-reads). Undated living documentation, displayed as version 8.0.0, inspected November 10, 2026.

FoundationDB tracks reads as well as writes when deciding which concurrent transactions can commit. Its snapshot-read example first reads a range, chooses one key, then explicitly protects that key. An insertion elsewhere need not invalidate the operation, but a change to the chosen value does. Reducing the protected read set is safe only when the needed invariant is still checked.

The useful design question is therefore which observations a result depends on. This is an analogy for an application-level contract, not a claim that PostgreSQL row locks implement FoundationDB conflict ranges. A model call outside the eventual write transaction does not acquire those guarantees merely because its result is committed transactionally. The guide does not identify an LLM's semantic dependencies or decide acceptable staleness. No FoundationDB adoption, transaction-isolation change, long-held database lock or general retry framework is proposed.

## Verified baseline and existing owners

Inspected at main `25c7a864947994b8f321ceab73e6b8eae14e3107`, the merge commit for #326. Merged status does not establish deployment. Repository [guidance](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/AGENTS.md), the [Pathways plan](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/docs/intent/pathways/plan.md) and [agent reference](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/docs/pathways-agent.md) remain authoritative for implementation.

| Observed code or test | Existing behavior to preserve; question left for this investigation |
| --- | --- |
| [agent.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/server/pathways/agent.ts) | Reads the pathway, incorporates linked task statuses, builds the prompt, awaits the model, converts the answer to operations, then calls `writePathway`. The selected research must have findings before the call. This identifies the read-to-apply interval; it does not measure its real-world contention. |
| [agent-input.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/server/pathways/agent-input.ts) | `researchText` numbers the selected card's sources in the prompt. `outline` also includes the question, goals, all cards' visible semantic fields, edges and planned-task status/results. `replyToOps` limits `fromResearch` to additions, edges involving new cards and appended note lines. Existing-card rewrites, merges and status changes are excluded. |
| [graph-ops.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/lib/pathways/graph-ops.ts) and [types.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/lib/pathways/types.ts) | `researchBasis` resolves 1-based source numbers from the graph passed to `applyOps`, deduplicates numbers and filters absent entries. New cards persist `{ nodeId, sources }` with source title/URL objects. These are evidence copies, not live source indices after the write; the shape does not include the research findings or a research revision identifier. |
| [pathway-store.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/server/pathways/pathway-store.ts) | `writePathway` takes a row lock, reads current state, applies the callback, saves a before-image revision and writes within the transaction, then publishes change. Undo and text-edit coalescing already exist. A fresh write target avoids replacing the entire map with a prompt-time copy; the current callback does not compare the research/prompt basis with that earlier read. |
| [graph-ops.test.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/lib/pathways/graph-ops.test.ts) | Already checks source-number binding, duplicate and invalid numbers, and a card without research, on one supplied graph. Retain this test. The proposed protocol varies the graph between prompt construction and application. |
| [pathway-store.db.test.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/server/pathways/pathway-store.db.test.ts) | Already checks revision/undo order and preservation of three concurrent additive writes. That protects a different property from prompt-basis validity. |
| [pathways-eval.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/scripts/pathways-eval.ts) | Uses production prompt/conversion helpers and applies a research-to-map answer to the case graph. Its model/judge evaluation does not inject a changed research snapshot between these stages. Keep model quality evaluation separate from deterministic temporal assertions. |
| [pathways-tools.ts](https://github.com/byronwall/visual-notes/blob/25c7a864947994b8f321ceab73e6b8eae14e3107/app/src/server/mcp/pathways-tools.ts) | MCP exposes the same numeric `fromResearch` input and shared operation/store path. Any later contract decision should consider this caller too, without silently changing its schema in a research PR. |

## Deduplication and scope boundary

All open PRs, all-state research/Pathways and semantic/conflict searches, relevant repository docs/tests, and the [reading history](https://chatgpt.com/space/page_e751f371f7c4819182252eb79d88810b) were inspected November 10. The open research proposals were [#212](https://github.com/byronwall/visual-notes/pull/212) and [#298](https://github.com/byronwall/visual-notes/pull/298); no matching source-number/interleaving protocol was found.

- #212 retains request lifetime, optimistic reconciliation, derived-work recovery and obsolete-embedding ownership. This proposal does not repeat that note-edit journey, add a queue or invent missing revision recovery.
- #298 concerns audio upload seams. Earlier saved-link research concerns an external page's intended version versus its later content. Here the immediate evidence is already in a pathway, and the question is which in-app read version the generated card represents.
- Earlier coordination, replication and cache readings do not settle this operation's dependency set. The October 26 ledger declined unmeasured Visual Notes contention work; this proposal makes no contention/performance claim. Its new independent trigger is #326's positional evidence binding and a falsifiable two-snapshot protocol.
- The existing Pathways plan and merged #308/#310/#311/#326 retain model, store, MCP and application ownership. This document supplements them; it is not a replacement implementation plan.

## Dependency worksheet

Record the exact prompt-time snapshot **S0**, the intervening write, the locked application snapshot **S1**, the fixed model reply and the accepted result. A test-only snapshot label is not an existing production revision token.

| Observation at S0 | What to compare at S1 | Why a blanket shortcut is insufficient |
| --- | --- | --- |
| Research question, findings and ordered source title/URL objects | Exact values and the meaning of every returned source number | Stable card identity does not guarantee stable research. Stable URLs alone do not prove unchanged findings. Source order matters to a numeric reference. |
| Selected card and referenced attachment targets | Existence and relevant kind/status/title/note plus edge context | A deleted or reinterpreted target needs an explicit result policy, even if graph cleanup remains valid. |
| Other inputs actually serialized by `outline`, plus hint/action | Capture the serialized input at a fixed clock, including goals, other cards, edges and task results/status | A distant card's note is still prompt-visible. Do not call it unrelated merely because the output does not attach to it. The model does not expose a reliable minimal dependency set. |
| Fields not passed to `mapPrompt`, such as `exportListId` | Preserve their S1 values while keeping the prompt basis unchanged | This is a concrete non-prompt edit control. An all-row timestamp/revision guard would also invalidate it. |

Begin with the complete prompt basis as a conservative comparison, using the same supplied time when rebuilding the prompt. Treat a narrower dependency set as a hypothesis needing its own counterexamples. Comparing only the selected research card is not established as sufficient. Linked task statuses are read outside the pathway row as well; the first probe should stub/freeze them and record that limitation rather than claim a whole-system serializable snapshot.

## Proposed deterministic protocol, not executed

Use invented map content, `.test` source URLs and an isolated test database following the existing repository harness. Do not use private maps, production writes or a paid model call. A separate authorized task could add a test-controlled deferred `callLLM` response while retaining the real `runPathwayAgent`, `replyToOps`, `applyOps` and store boundary. Avoid a copied miniature implementation of those functions.

1. Seed selected card R with question Q, findings F0 and ordered sources `[A, B]`. Capture the actual prompt. Hold a fixed schema-valid reply that adds one step referring to source `[2]`, attaches it to R, and appends a dated note line.
2. Commit one controlled intervening edit through the store while that reply is held. Keep task status and clock fixed. Record S1 and revision history, then release the same reply.
3. Inspect persisted new-card evidence, retained concurrent edits, graph targets, appended notes and revision/undo behavior. Report the baseline's observed result separately from the contract one would prefer. Do not convert source-code inference into a passing/failing integration-test claim.

| Case | Intervening edit | Assertion or question to record |
| --- | --- | --- |
| Unchanged control | None | Source 2 means B; existing additive restrictions and normal revision/undo behavior hold. |
| Reordered evidence | Sources become `[B, A]`, same question/findings | Does the result still identify S0's B, explicitly decline the old basis, or take a separately documented historical-basis path? It must not be called current grounded work solely because the write succeeded. |
| Replaced evidence | Replace B with C at index 2 | Distinguish stable numeric position from evidence identity. Compare stored title/URL objects with the exact prompt. |
| Changed findings | Keep `[A, B]` but change the finding or research question | A sources-only equality check can miss the semantic change. Decide whether this answer remains acceptable before proposing a guard. |
| Non-prompt control | Change only `exportListId` through the store | Prompt input stays equal and the preference survives. Measure whether a candidate guard rejects harmless work. This is not a blanket claim that arbitrary map edits commute. |
| Wider prompt change | Change a goal or another card's prompt-visible note | Demonstrate why a selected-card-only comparison needs justification; classify this as a potential dependency, not an unrelated edit by default. |
| Removed basis or target | Remove R, or a referenced existing attachment target | Record missing provenance, skipped references and orphan behavior separately. Define refusal or explicit historical handling before implementation; do not silently repair the meaning with another card. |

Repeat each case with deterministic IDs and the identical fixed reply. Record accepted/refused/historical outcomes, source binding, concurrent-edit retention, appended-line retention, revision count and false rejections on the non-prompt control. A candidate pre-apply refusal must leave the concurrent edit intact and add no empty agent revision or success notification. Compare actual semantics, not just counts of saved cards. Model-quality scores and CI success cannot substitute for these assertions.

## Candidate contracts and tradeoffs

These are choices for review, not recommendations already selected:

1. **Validate before applying.** Compare a recorded basis with current inputs inside the existing write boundary. Decline changed dependencies and let the caller decide what to do next. A coarse basis is easier to reason about but can reject harmless work; a narrow one can omit context the model used. Automatic model retries are outside this proposal.
2. **Keep an explicitly historical basis.** Resolve citations against S0 and retain an identifiable research snapshot, with clear historical meaning. That can preserve what the model saw but does not establish that the proposed action fits the person's new goals. Source snapshots alone do not answer the acceptance question.
3. **Retain the current contract.** If the product intentionally accepts suggestions from earlier context and the observed behavior meets a clearly documented source-binding policy, keep it. A new mechanism is not required just because an interleaving can be described.

Stable source identifiers, research revisions and prompt-basis fingerprints are possible implementation techniques only after choosing the contract. Neither a whole-row timestamp nor a source ID alone is a complete semantic-validity proof. Do not hold the row lock during the model call, change database technology, or expand into general idempotency/retry work on the strength of this note.

## Follow-ups and stopping rule

A future authorized task should refresh main and related PRs, choose expected outcomes with the existing Pathways owner, run the unchanged/reordered/non-prompt controls first, and expand only if those distinguish the candidate contracts. Keep the production design if the behavior matches the intended policy or if a proposed guard adds no useful discrimination. Require a reproducible observation and an agreed acceptance contract before describing an implementation defect or requesting a code change.

Open questions: whether an old-basis suggestion should be rejected or labeled historical; which wider prompt inputs are material; how linked-task status participates; how MCP callers convey the same basis; and whether appended factual note lines need the same policy as new cards. No request throughput, contention frequency or user-facing latency benefit has been measured.

## Verification and process

Delivered one research document. Primary-source sections, pinned code/tests, repository guidance, current PR states, prior research conventions and deduplication history were read. The document follows the existing `docs/research/daily-brief-<date>-<topic>.md` convention. No application, test, dependency, workflow or agent-guidance files are changed.

Local application suites, browser checks, model evaluations and the proposed interleaving experiment were **not run**. Documentation validation is whitespace/provenance/link-target inspection and remote content/diff verification; repository CI, when reported, applies only to the published documentation head. The existing #326 test/eval claims are not new results from this investigation.

Process improvement: future concurrency research should name the exact observations used to produce a result and include a verified non-prompt edit control, rather than presume every other-card edit is irrelevant. The next test design is the appropriate place to encode that rule. Agent/skill changes: none; no new generic repository instruction is justified by an unrun proposal. Remaining risk is an untested acceptance contract, not an established production incident.
