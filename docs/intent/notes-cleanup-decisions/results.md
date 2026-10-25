# Experiment results: note cleanup with Jev and OpenAI Decisions

Run on October 24, 2026 against 144 prod notes, following the protocol in [question-design.md](question-design.md). Scripts are in [experiment/](experiment/). Note text and raw answers stayed in the session scratchpad, and nothing was written to prod.

**Spend:** Jev $0.061 (641 requests). OpenAI $0.232 (785 requests, including the LLM baseline).

## What was run

| Run | Requests per vendor | What it measures |
| --- | --- | --- |
| `note` | 144 | The 12 per-note questions, batched in one call |
| `note_rep` | 144 | The same call again, for self-consistency |
| `note_rev` | 144 | The Choice questions with options reversed, for order bias |
| `note_v2` | 144 | `todo_list`, `copied_or_generated`, and one holistic `verdict` Choice |
| `sections` | 29 | A Noul per section, for split detection |
| `pairs` | 36 | 28 related pairs and 8 pairs that only share vocabulary |
| `llm` (OpenAI only) | 144 | The same 12 questions through `gpt-6-luna` Responses with a JSON schema |

Models: `jev-1.14.0` (current `jev-latest`) and `gpt-6-luna` on `/v1/decisions`.

**Reference labels:** a Claude subagent read every note in full and answered the same questions plus an overall verdict. **This is not Byron's judgment.** The reference is harsh: 58 delete, 21 archive, 52 keep, 7 trim, 6 make-task. It marked `house wiring` for deletion as "copied generic wiring explanation". All agreement numbers below measure agreement with that reference. Byron's labels are the next step.

## Update: scored against Byron's labels (60 notes)

Byron labeled 60 notes blind: all 41 holdout notes plus 19 dev notes where the model and reference disagreed most. Scripts: [`analyze_byron.py`](experiment/analyze_byron.py).

**His labels:** 37 keep, 14 keep-but-trim, 6 archive, 2 make-task, 1 delete.

**The Claude reference is the wrong ground truth.** It matches Byron on only 33% of exact verdicts and 52% of drop-vs-keep calls, which is close to chance. The pattern is consistent: notes the reference called *delete* (generic ChatGPT chats, imported tidbits, generated digests), Byron calls *keep but distill the durable part* or *keep, but it belongs with related notes*. The "drop" numbers below this section measure agreement with Claude's taste, not Byron's.

**What cleanup means to Byron:**

| Action | Share of the 60 | His reasons |
| --- | --- | --- |
| Keep as is | 62% | "something I compiled and shared", "link to an ongoing thread" |
| **Distill / trim** | 23% | "any durable info in there to distill out?", "could be summarized now that the event has passed" |
| **Regroup** (a keep with a note) | 5 of the keeps | "belongs in a prompt collection", "needs connecting to a journal collection", "needs to be with other tidbits" |
| Archive / delete | 12% | "not timely"; a collection row that "should not be accessible as a note by default" |
| Make task | 3% | two notes; `is_todo` caught both (0.82–0.95) |

**Which signals predict his labels** (AUC, Jev / OpenAI):

| Signal | Needs action (38%) | Trim (23%) | Drop (12%, only 7 notes) |
| --- | --- | --- | --- |
| **`copied_or_generated`** (one Noul) | 0.74 / 0.75 | **0.93 / 0.92** | 0.41 / 0.43 |
| `src_chatgpt` (code fact) | 0.72 | 0.81 | 0.49 |
| `not_worth_reading` | 0.67 / 0.77 | 0.51 / 0.67 | **0.82 / 0.83** |
| `empty_or_stub` | 0.63 / 0.52 | 0.41 / 0.46 | 0.87 / 0.55 |
| Drop score trained on Claude labels | 0.73 / 0.74 | 0.77 / 0.80 | 0.64 / 0.63 |
| Holistic `verdict`: P(keep_but_trim) | 0.35 / 0.24 | **0.51 / 0.40** | 0.28 / 0.20 |
| Weights refit on Byron's 60 (leave-one-out) | 0.64 / 0.71 | 0.84 / 0.85 | — |

Takeaways:

- **One atomic question finds the distill queue.** Sorted by `copied_or_generated`, the top 10 notes were 9 trims and 1 archive on both vendors, so all 10 needed action. The top 20 held 13 of the 14 trims (Jev).
- **The holistic question can't find "trim" at all** (AUC 0.40–0.51, chance or worse). This is the strongest evidence in the experiment for atomic questions combined in code.
- **The drop score trained on Claude's labels doesn't transfer.** Taste lives in labels, and only the owner's labels count. With 60 labels, a refit with few parameters does no better than the single `copied_or_generated` signal for trim.
- **"Regroup" is a real action that no per-note question covers.** It needs the pair and group questions: "does this belong with `group`?" and a Choice over existing collections and paths.

**Revised product shape** (supersedes the delete-first framing above; the UI and build order are in [ux-decisions.md](ux-decisions.md) and [Next steps](#next-steps)):

1. **Distill queue:** rank by `copied_or_generated` (plus `src_chatgpt`). An LLM pulls out the durable facts, keeps a link to the original, and Byron approves.
2. **Regroup suggestions:** use embedding neighbors, `better_together`, and a Choice over existing collections (prompts, journal, tidbits). Byron approves a move.
3. **Post-event summaries:** code finds expired dates, `time_anchor` says it is an event or plan, and `evergreen_core` decides between summarize and archive.
4. **Make-task:** `is_todo` at ≥ 0.8.
5. **Delete:** rare. Use `empty_or_stub` and `not_worth_reading`. Collection rows should not show as standalone notes in the first place (a product fix, not a model one).

## Headline (against the Claude reference)

1. **Atomic questions work.** Both APIs agree with the reference on 80–97% of the narrow questions, the same level as an LLM asked the same questions. They are 15–25× faster.
2. **Code should combine the answers, not a holistic question.** Weights fit on the atomic answers separate drop (delete/archive) from keep at **AUC 0.92–0.94 on holdout** and **86% accuracy** (leave-one-out). The **30 notes ranked most likely to drop were all drops** by the reference, and 54 of the top 60 were. A single "what should he do with this note?" Choice reached only AUC 0.83–0.88. My hand-written threshold rules did worst, at 67–73% coarse agreement.
3. **Pairs work.** Related pairs separate from pairs that only share vocabulary at AUC 0.98–0.99.
4. **Cost doesn't matter, but latency does.** A full pass over all ~6,300 notes would cost about $0.70 on Jev or $2.20 on OpenAI. Both answer in 0.2–0.3 s, so assessing on save is realistic. The LLM baseline took 3.8 s p50.

## Speed, cost, stability

| | Jev | OpenAI Decisions | LLM baseline |
| --- | --- | --- | --- |
| Latency p50 / p95 | 0.17 s / 0.22 s | 0.24 s / 0.31 s | 3.8 s / 6.3 s |
| Mean input tokens per note | 2,549 | 3,495 | ~2,000 |
| Cost per 1,000 notes (12 questions) | $0.11 | $0.35 | $0.41 |
| Self-consistency (same call twice) | mean \|Δp\| 0.014; up to 8/144 flips at the 0.5 line (`rederivable`) | deterministic, 0 flips | — |
| Order bias (Choice options reversed) | `kind` flips 7/144 (5%), `time_anchor` 6 | `kind` flips **20/144 (14%)**, `time_anchor` 10 | — |

OpenAI's `kind` question is over the 10% order-flip bar set in the protocol, so its options need contrastive `not_for` wording before `kind` can drive anything. Jev is close to the bar but under it. Jev's small run-to-run noise only matters for notes sitting near a threshold, so use a review band around each threshold rather than a single cutoff.

## Per-question agreement with the reference

AUC is shown for yes/no questions, using the probability as a ranking score.

| Question | Jev agree (AUC) | OpenAI agree (AUC) | LLM agree | Jev vs OpenAI |
| --- | --- | --- | --- | --- |
| `author_specific` | 0.83 (0.90) | 0.84 (0.93) | 0.84 | 0.88 |
| `rederivable` | 0.83 (0.90) | 0.83 (0.89) | 0.83 | 0.87 |
| `time_anchor` | 0.81 | 0.77 | 0.78 | 0.85 |
| `evergreen_core` | 0.83 (0.86) | 0.83 (0.68) | 0.83 | 0.99 |
| `tech_staleness` | 0.86 | 0.71 | 0.78 | 0.80 |
| `empty_or_stub` | 0.94 (0.99) | 0.93 (0.85) | 0.97 | 0.99 |
| `import_junk` | 0.93 (0.99) | 0.97 (0.99) | 0.97 | 0.96 |
| `kind` | 0.81 | 0.81 | 0.76 | 0.86 |
| `length_fit` | 0.68 | 0.73 | 0.79 | 0.72 |
| `is_todo` | 0.87 (0.93) | 0.88 (0.94) | 0.95 | 0.95 |
| `worth_reading` | 0.73 (0.81) | 0.76 (0.87) | 0.67 | 0.78 |
| `title_fits` | 0.80 (0.89) | 0.83 (0.87) | 0.79 | 0.84 |

Takeaways:

- The structural questions (`empty_or_stub`, `import_junk`) are near perfect on both vendors. The provenance questions (`author_specific`, `rederivable`) rank well at AUC ~0.9.
- `worth_reading` is the weakest, and it is also the most subjective. It disagrees with the reference mostly on generic ChatGPT CSS troubleshooting chats ("worth reading" to the model, "generic" to the reference) and on generated reading digests.
- `length_fit` is the weakest scored question. In the weight fit it barely matters, so drop it or reword it.
- `is_todo` ranks well (AUC 0.93), but at 0.5 it fires on 28–29 how-to and plan notes, including the bathroom-fan canary. The v2 `todo_list` wording halves the false positives (15 and 12) but ranks worse (AUC 0.85–0.88). The fix is a higher threshold on `is_todo`, not new wording.

## Combining answers into a verdict

Drop means delete or archive. Base rate is 55% drop.

| Method | Jev | OpenAI |
| --- | --- | --- |
| Hand-written threshold rules (default) | 68% coarse | 67% coarse |
| Hand rules, thresholds tuned on dev → holdout | 73% | 61% |
| One holistic `verdict` Choice | 72% coarse, drop AUC 0.83 | 81% coarse, drop AUC 0.88 |
| `worth_reading` alone as the score | AUC 0.77 | AUC 0.88 |
| **Logistic weights on atomic answers + code facts, train dev → holdout** | **AUC 0.92, acc 83%** | **AUC 0.94, acc 80%** |
| Same, leave-one-out over all 144 | AUC 0.89, acc 86% | AUC 0.92, acc 86% |
| Precision of the top 30 / top 60 drop scores (LOO) | 100% / 90% | 100% / 90% |

Largest weights are the same on both vendors:

- Toward drop: `src_chatgpt`, `copied_or_generated`, `rederivable`, `src_bulk`.
- Toward keep: `author_specific`, `is_todo`, `worth_reading`.

The model learned roughly "did Byron write it, and could he get it again?". The code facts (source) and the decision answers each add signal.

Caveat: the weights were fit on 144 notes against Claude's labels. The ranking is the useful part: sort the review queue by drop score and Byron works top-down. Do not auto-delete on these numbers.

## Pairs and splits

- **Relation tier:** exact tier matched my provisional labels 69% (Jev) and 72% (OpenAI). Most misses were one tier apart and arguable. For example, the two insurance notes were called `same_content` where I had said `same_problem`, and the two eyeglasses snapshots were also called `same_content`, which is correct: one supersedes the other.
- **Related vs vocabulary-only:** AUC 0.98 (Jev) and 0.99 (OpenAI). This is the number that matters for merge candidates. Generating candidates from embeddings and confirming them with a decision call works.
- **Split detection:** Jev flagged 1 note (`Building log, March 2026`, 5 of 7 sections off-topic). OpenAI flagged 6, including the two agent reading digests and the gh CLI cheat sheet. The build log is a real split candidate. The others are monthly or dated digests that are fine as they are. This needs Byron's judgment before it's useful.

## Canaries

| Note | Reference | Jev / OpenAI (default rules) |
| --- | --- | --- |
| House Work Timeline | keep | keep / keep |
| woodwork cabinet | keep | keep / keep |
| Replace bathroom exhaust fan motor | keep | **make_task** / **make_task** (the `is_todo` false positive) |
| house wiring | *delete* (reference) | keep / keep (my canary said keep) |
| daily journal 2022-02-28 | *archive* (reference) | keep / keep |
| Voice note (blank), `js` Notion hub, `js react unstated` stub | delete | delete / delete |

The canary disagreements are between my judgment and the reference, not the APIs. That's the gap Byron's labels close.

## Vendor call

The two are close. **Start with Jev:**

- 3× cheaper and ~30% faster.
- Less order bias on Choice questions.
- Slightly better on the structural questions and `tech_staleness`.

OpenAI ranks slightly better on `worth_reading` and the drop score, and it is deterministic. Keep the adapter so we can switch. Neither one is the bottleneck. The question wording and the code that combines answers are.

## Next steps

1. ~~Byron labels 60 notes~~ Done. See the update at the top. The distill queue is the first thing worth building.
2. **Wording fixes for v3:**
   - Raise the `is_todo` threshold to about 0.8.
   - Add `not_for` contrasts to `kind` (OpenAI order bias).
   - Drop or reword `length_fit`.
   - Keep `copied_or_generated`.
3. **Build it** in this order. Each step is reviewable on its own. Every action stays a user click (see [ux-decisions.md](ux-decisions.md)).
   1. **Plumbing:** a `decide()` helper (Jev first, with an adapter for OpenAI), and a `NoteAssessment` table keyed by content hash. Assess weekly and on save. Exclude collection rows, events, and places. Send every other note.
   2. **Archive lifecycle:** archived notes are hidden from search, lists, and related notes. Links redirect to the note the content went into. An Archive page shows a countdown and Restore. Notes are deleted automatically after 30 days and leave a tombstone. Distill depends on this, because approving archives the original.
   3. **Triage page with the Distill bucket:** the 3-pane `/cleanup`, ranked by `copied_or_generated` (plus `src_chatgpt`). The LLM drafts on demand. Send to a new or existing note, then archive the original. Includes the optional side-by-side review for editing.
   4. **Inline chip:** a **Cleanup** chip and popover on flagged notes, opening the triage view.
   5. **Regroup:** suggested clusters from embedding neighbors plus `better_together` and the cover Nouls, which merge into one note and archive the rest. Also a move into an existing collection or path, without a rewrite.
   6. **Post-event:** an expired date from code plus `time_anchor`. `evergreen_core` chooses between "keep the evergreen part, then archive" and "archive only".
   7. **Make task** (`is_todo` ≥ 0.8) and **Delete** (rare: `empty_or_stub`, `not_worth_reading`).
   8. **Daily stack:** card mode with a daily quota and Snooze 30 days. **Keep as is** hides a note for 6–12 months.
