---
title: End-to-end request and derived-work ownership
origin: repo-reading-brief
topic_id: visual-notes.request-derived-work-ownership.v1
source_editions: [2026-10-19, 2026-10-21, 2026-10-23]
status: research-proposal
---

# End-to-end request and derived-work ownership

Assistant-generated research; origin: `repo-reading-brief`; stable topic ID: `visual-notes.request-derived-work-ownership.v1`. Exclude this document, its branch, PR, and derivative assistant research from future substantive-activity ranking. This is an investigation proposal, not implementation or evidence of new product activity.

Source editions, read October 24, 2026:

- [October 19, 2026 — query policy and ownership](https://chatgpt.com/space/page_9bc9855faafc8191a9294d5839647e01).
- [October 21, 2026 — whole-operation lifetime](https://chatgpt.com/space/page_ab935e9e6bb8819186341ae0b5168e6f).
- [October 23, 2026 — request-to-background-work handoff](https://chatgpt.com/space/page_53e9b8a325b481919db0329bb3f1ecc7).

## Decision to investigate

The recurring need is holistic network handling: which layer owns an operation from intent through authoritative mutation and current derived state? Compare existing primitives first, one scoped lifetime second, and durable revision scheduling only if measured recovery or diagnosability justifies it. This PR adds no library, queue, retry wrapper, server change or real-user fault injection.

## Original source synthesis

| Primary source and publication date | Transferable idea and limit |
| --- | --- |
| TkDodo, [Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions), February 23, 2026 | Small query-options factories colocate keys and read functions without rebuilding the library's generic API. Share query identity and policy while leaving presentation local. This is not a recommendation to migrate SolidStart reads. |
| TkDodo, [Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query), April 28, 2025 | An earlier mutation's invalidation can overwrite a later optimistic edit. Cancelling reads helps some timings; invalidation must also respect related pending mutations. Optimistic filtering duplicates server semantics. React examples are a lens for the existing task queue, not drop-in Solid code. |
| Charles Lowell, [What is Strict Structured Concurrency?](https://frontside.com/effection/blog/2026-04-07-strict-structured-concurrency/), April 7, 2026 | Foreground completion halts supporting background work, and the scope waits for child cleanup. Transport still needs cooperative abort. A nominal timeout can be exceeded by awaited cleanup. Shared work needs an owner beyond one subscriber. A lifetime model does not supply caching or durable mutation semantics. |
| Brandur Leach, [Transactionally Staged Job Drains in Postgres](https://brandur.org/job-drain), September 20, 2017 | Dispatch before commit risks invisible/rolled-back data; dispatch after commit leaves a crash gap. Transactionally recording the obligation closes that gap. The example assumes a single enqueuer and repeatable-read isolation. Delivery can repeat, so at-least-once is not exactly-once effects. |
| Brandur Leach, [River: a Fast, Robust Job Queue for Go + Postgres](https://brandur.org/river), November 20, 2023 | Operational experience changes database-queue tradeoffs; keeping accepted data and work in one transactional system can simplify failure handling. This does not justify adopting Go, River or another queue in Visual Notes. |

The added contribution is an integrated ownership matrix and one revision-correlated experiment. None of these sources alone decides the application's conflict, auth, retry or obsolete-result policy.

## Verified current state and deduplication

Inspected October 24, 2026 at main `62d773b529fc9feba46ac05fb562acba77f33bb4`. Links below pin that state.

- [AGENTS.md](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/AGENTS.md) prefers SolidStart query/resources and server actions, and says not to add another query library. [package.json](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/package.json) and [app.tsx](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/app.tsx) already include TanStack Solid Query and its provider. Presence of a provider does not prove every note path uses it. Map the selected path before assigning ownership.
- [createTaskActions.ts](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/components/tasks/createTaskActions.ts) already serializes optimistic writes, counts pending writes and reconciles after 400 ms of idle time. Cleanup clears its reconciliation timer. [#106](https://github.com/byronwall/visual-notes/pull/106) did not reliably preserve those task fixes in the merged tree; merged [#148](https://github.com/byronwall/visual-notes/pull/148) restored the orphaned changes. Treat that race as an existing repaired decision, not a newly discovered gap.
- [writeNoteContent](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/server/notes/note-write.ts) locks the row, increments contentVersion and rebuilds the block index in the transaction. Stale writes with base hashes merge blocks; same-block conflicts preserve the stored version as a conflict revision while incoming content wins. This is an existing conflict policy, not general offline convergence.
- [db.ts](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/server/db.ts) buffers note notifications through transaction completion. [note-store.ts](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/server/notes/note-store.ts) provides the content-change scheduling hook. Post-commit notification and durable work acceptance answer different questions.
- [useLiveNoteResource](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/features/live-sync/useLiveNoteResource.ts) checks note identity and timestamps, uses mutate to avoid unmounting the editor, and leaves content ownership with the editor. [Mutation acknowledgment guards](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/hooks/noteMutationAcknowledgements.ts) already check returned identity/success. A valid acknowledgment is distinct from a durable operation-deduplication receipt.
- [embedding-refresh.ts](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/server/notes/embedding-refresh.ts), blob `690cf9d1` prefix, uses a 10-second debounce plus a startup pass and 15-minute sweeps. It drains missing and changed embeddings in batches of 25, with bounded follow-up passes, for both the latest search embedding run and the latest map's embedding run (deduplicated when equal). Sweeps also project unplaced points and can initiate retraining. Refresh skips without an API key and logs caught failures. Lost debounce is **not demonstrated lost work**: startup/sweeps can rediscover stale state, with recovery conditional on a running configured server and successful processing.
- [jobs-db.ts](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/app/src/server/jobs-db.ts) stores job JSON files under data/jobs and serializes writes with a process-local promise queue. This is persistence plus local serialization, not proof of atomicity with note transactions, multi-process leasing, or exactly-once effects.

Open [#206](https://github.com/byronwall/visual-notes/pull/206) adds task-line feedback to note writes; open [#207](https://github.com/byronwall/visual-notes/pull/207) changes search vector-index updates. Neither is main behavior. Other open proposals #208–211 concern images/MCP documentation/activity/collections. Reviewed open titles/bodies and current docs; no matching integrated ownership experiment was found. The existing [mutation acknowledgment summary](https://github.com/byronwall/visual-notes/blob/62d773b529fc9feba46ac05fb562acba77f33bb4/docs/note-mutation-acknowledgments-work-summary.md) is prior work to preserve, not an invitation to repeat its fixes.

## Candidate ownership matrix — analysis, not a completed audit

"Current owner" names observed seams; it does not assert complete coverage. A future agent must trace the concrete note path, including whether a read uses SolidStart or Solid Query.

| Responsibility | Current owner / evidence | Candidate integrated solution | Unresolved app/server responsibility |
| --- | --- | --- | --- |
| Transport, auth, abort, deadline, retry budget | Server actions and service reads; authentication at server boundary | One documented operation budget with attempt counts; propagate abort into actual I/O; normalize errors at the existing boundary | App chooses auth/reconnect UX and safe retry classes; server authorizes every attempt. Who owns total attempts and body-read timeout? |
| Query keys, dedupe, freshness, invalidation, stale guards | SolidStart queries/resources, existing Solid Query provider, live-note timestamp/identity guard | Per-domain key/read definitions; explicit invalidation relationships; shared request owned above individual subscribers | App defines permitted staleness and scope of related writes; server supplies authoritative version. Do both cache systems touch this path? |
| Operation lifetime and awaited cleanup | Component cleanup and individual async continuations | First compare an explicit scope using existing AbortController/disposers; evaluate a structured-concurrency model only for that operation | Which work is subscriber-local versus shared? Who awaits timer/listener/body cleanup, and how is cleanup duration reported? |
| Optimism, rollback, offline conflicts | Task write queue plus idle reconciliation; editor drafts; versioned block merge | Preserve ordered writes and draft ownership; suppress stale commits; show pending/rejected/conflict state | App owns rollback and offline queue-or-reject policy; server resolves accepted revisions. Rollback cannot undo a committed write. |
| Mutation identity and receipt | Existing acknowledgment checks and contentVersion; open #206 feedback is separate | Correlate logical operation, HTTP attempts and persisted result; outcome lookup before unsafe repeat | Server defines idempotency scope, dedupe retention and receipt durability; app handles unknown outcomes. Current acknowledgment does not prove retry safety. |
| Derived-work obligation and obsolete revision | Debounce + startup/periodic recovery; file-backed jobs for other work | Measure recovery first; if needed compare a transactional obligation keyed by note/revision/run with completion/supersession state | Server defines whether every revision or only latest must process, rejects obsolete results, and exposes terminal failure; app distinguishes saved from indexed |
| Observability across all layers | Task errors, note-write merge logs, embedding/job logs and activity paths | One trace record joining operation ID, note revision, HTTP attempt, receipt, derived revision and visible UI state | Agree redaction, retention and terminal states; do not log real note bodies. Missing telemetry means unknown, not success. |

## Small synthetic note-edit experiment for a future agent

Use an isolated test database and invented note content. No live account, real-user traffic or production fault injection. This research PR does not create a harness or run the experiment.

Instrument the trace as: timestamp, logical operation ID, subscriber ID, note ID, base/accepted contentVersion, HTTP attempt, abort/deadline reason, commit/receipt state, embedding run and derived revision, UI state, cleanup completion. If a production receipt or revision field does not exist, record that explicitly; a test trace is not a durable server receipt.

| Step | Observe and assert |
| --- | --- |
| Delay a read, then perform edits A and B | Earlier responses/invalidation must not erase B's pending UI. Distinguish serialization, cache refresh and editor merge behavior. |
| Two subscribers share a read; unmount one | Its listener/timer cleans up; the remaining subscriber still receives the needed result. Record whether the underlying path actually deduplicates. |
| Drop the response after server commit | Persisted revision survives. UI says outcome unknown until reconciled; no blind non-idempotent repeat or false rollback claim. |
| Restart before the 10-second debounce | Measure startup/sweep discovery and time to current embeddings in both search and map runs. Losing a timer alone is not a failure assertion. |
| Delay embedding, edit again during processing | Correlate read and write revisions; detect whether an obsolete result can become current. Record superseded work separately from failed work. |
| Reconnect and reload | Check authoritative content, retained/conflicting drafts, receipt/outcome resolution and derived freshness. Cached reads do not prove durable queued writes. |

Record recovered versus stranded obligations, duplicate side effects, stale-result commits, total HTTP attempts, visible regression duration, recovery latency and cleanup latency. Keep "saved", "processing pending", "processing failed", "superseded", "derived current" and "outcome unknown" distinct.

Run the same sequence against (A) current primitives, then (B) a narrowly scoped operation lifetime, and only if justified (C) a design sketch for durable per-revision obligations. Compare diagnosability, recovery time and operational cost. At-least-once delivery requires idempotent or deduplicated effects; a query cache cannot prove mutation durability; browser cancellation cannot undo a committed write.

## Questions, tradeoffs and decision gate

- Does the current startup/sweep recovery meet the freshness requirement? Who sets that requirement?
- Is "latest revision eventually current" sufficient, or must every accepted revision produce derived work?
- Can existing version/identity guards and queued reconciliation cover the troublesome operation without a new programming model?
- Is a gap an ownership problem, missing instrumentation, or an actual recovery failure? Measure those separately.

A separate future agent should refresh main and #148/#206/#207 state, trace one note read/write/embedding path, fill the matrix with call sites, then specify expected outcomes before requesting implementation authorization. Retain the current design if it meets the measured requirement. Choose scoped lifetime work only for demonstrated cleanup/ownership problems. Consider durable scheduling only for a measured recovery or diagnosability benefit exceeding its schema/worker/operational cost. Do not broaden into admission control or a replication migration.

## Verification, process and remaining limits

Delivered one research document; no application behavior changed. Primary-source text, edition content, repository guidance, relevant data/async and post-work documentation skills, PR states and pinned code were inspected October 24, 2026. The query-abstraction article's full-text endpoint timed out on re-fetch; its dated primary search record and retrieved edition support the limited summary above. The other primary articles were available as full text. No test, benchmark or synthetic fault sequence was run, and no claim of deployed behavior is made.

Process improvement: future briefs should identify existing owners and repaired decisions before suggesting tools, and should exclude this origin/topic from substantive-activity ranking. No AGENTS/skill edits are included. Remaining risks are untraced path-specific behavior, unknown receipt guarantees, and unmeasured obsolete-embedding/recovery behavior. Repository CI checks the documentation commit, not this unimplemented hypothesis.
