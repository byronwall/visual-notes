# Note cleanup with decision models (Jev / OpenAI Decisions API)

Research, October 24, 2026. Nothing here is built yet. No TypeSafe or OpenAI key is set up locally, so no live calls were made. The "paper prototype" below is hand-scored against 20 notes sampled from prod over MCP.

## TL;DR

- **Decision models fit this job well.** Every cleanup question you listed ("keep it?", "too long?", "too many topics?", "same subject as that note?") has a bounded answer. Jev and OpenAI Decisions return typed, probability-scored answers to bounded questions. That means no output parsing, and the probabilities give a threshold you can sort a review queue by.
- **Cost isn't the deciding factor at your scale.** One full pass over ~3,000 notes costs about **$0.15 on Jev** and **$0.35 on OpenAI Decisions**. A flash-tier LLM doing the same pass is a few dollars. The real wins are calibrated scores, ~100–300 ms latency (fast enough to run on save), and making **pairwise** questions affordable (merge and related detection), where the call count grows with pairs, not notes.
- **They judge, they don't write.** Neither API can write a summary, a split, or a new title. The pattern that works: **heuristics → decision model triage → LLM only on the small flagged set → human review.**
- **Half of the cruft doesn't need any model.** Empty notes, Notion hub pages, GitHub-star stubs, and raw ChatGPT transcript dumps are all detectable from structure. Do that first, for free.
- **Fix one data problem first:** almost every note has `updatedAt` ≈ 2026-10-20 04:4x from a bulk rewrite, so "last touched" can't be used as a staleness signal right now. Use `createdAt`, `DocActivitySnapshot`, and in-body dates instead.

## The two APIs

| | TypeSafe **Jev** | OpenAI **Decisions API** |
| --- | --- | --- |
| Status | GA | GA Oct 22, 2026 (beta Oct 6) |
| Endpoint | `POST api.typesafe.ai/v1/systemone` | `POST /v1/decisions` (per secondary coverage) |
| Input | `state`: string / JSON object / array. Questions can point at fields with `` `note.body` `` | `input`: text, images, or `input_json` parts |
| Question types | `noul` (yes/no prob), `choice` (≤255 options), `score` (2–10 levels) | predicate, choice, score. Same output shapes |
| Batching | All questions run in parallel on one state. 13 questions in 1 call was 12× cheaper than 13 calls | Up to 400 questions per request |
| Context | ~64k shared, ~32k state+question (262k "danger zone" header, slower and worse) | Not published |
| Price | $0.042 / M input, output free | $0.10 / M uncached input, output free. Cache discounts apply |
| Latency | ~100 ms typical, 70–500 ms | "~10× faster than Responses" (vendor claim) |
| Images | Billed as input, but text-first in practice | Yes (base64 or URL) |
| We already have | Nothing | `OPENAI_API_KEY`, `callLLM`, `LlmRequest` log (`server/lib/ai.ts`) |

Caveats from independent work:

- **Probabilities shift when options are reordered.** Freeze option order per question version.
- **Accuracy drops as irrelevant context grows.** Send trimmed text plus structured facts, not the full 16k-word note.
- **Cheap ≠ always cheapest.** A tuned gpt-4.1-nano single-token classifier came in slightly *under* Jev per decision on a 4-class news task, though Jev was more accurate (88% vs 70–83%).
- **Errors are correlated with LLM judges.** Rao & Callison-Burch found decision models trail flash-tier LLM judges significantly in at most 6 of 27 comparisons, at 16–357× lower cost. But >85% of their confident errors are *shared* with LLMs, so an LLM fallback buys little accuracy (≤2.7 pts). For us, uncertain cases should go to **you**, not a bigger model.

## What prod actually looks like (sample of 20)

Path tree total is ~1,100 filed notes, plus a large unfiled set. The archetypes, roughly in order of how much cleanup each yields:

| Archetype | Example | What it wants | Needs a model? |
| --- | --- | --- | --- |
| **Notion hub pages** | `js` (100 links to `__NOTION__…` children), `house` | Delete. The path tree already shows this | No: >90% of blocks are links to children of its own path |
| **GitHub-star stubs** | `js react unstated` (one `\|\|\|`-delimited repo row, 7.7k stars) | Fold into one "libraries" collection, or drop | No: detect `\|\|\|` rows |
| **ChatGPT transcript dumps** | `JS Libraries for CSV conversion.` (2023, lists jQuery-CSV) | Keep the answer, drop the chat framing. Often generic and dated | Detect: no (`Link back: chatgpt.com`). Judge value: **yes** |
| **Near-duplicate clusters** | `CSS Animations and Transitions` / `…and Gradients` / `CSS slide effect` / `animation on removal` / `Rotation Animation Ease` | Merge into one CSS-motion note | Candidates: embeddings. Verdict: **yes** |
| **Empty captures** | `Voice note · Oct 21 at 1:39 PM` (blank) | Delete or nag | No: zero text, no audio |
| **Collection-row shells** | `Orange lights` (empty body, row in *Halloween products*, Status=Done) | Leave alone. The row is the value | No: exclude collection rows |
| **Expired time-bound notes** | `AI events in Indy` (July 2026 event table, "re-check July 22"), insurance quotes, `Cub Scout Camping Trip` | Archive, or keep a slim evergreen part (the recurring channels, packing list) | **Yes**: time-bound plus has an evergreen core |
| **One-line action items** | `Finance quick plan` (a one-line phone-call reminder), `Random LLM tasks` | Become a task, delete the note | **Yes**: "is this really a task?" |
| **Thin evergreen tips** | `house tips` (one line about insulation) | Merge into a parent house note | **Yes**: plus merge target |
| **Logs (long and fine)** | `House Work Timeline` (3,464 words, dated table) | **Keep as is.** Long ≠ needs summarizing | **Yes**: "is length structural?" |
| **Real knowledge** | `house wiring`, daily journal with math notes | Keep | Model confirms keep |

Takeaways:

- About half of the obvious cruft is structural. Rules alone could clear the Notion hubs, star stubs, and empty captures (likely several hundred notes).
- The judgement calls are **time-boundness**, **genericness** (a 2023 ChatGPT answer you'd re-ask today), and **merge targets**. Decision models are good at all three.
- "Too long" is a trap without context. The longest notes in the sample are logs and reference tables that *should* be long. The question has to be "is the length doing work?", not a word count.

## Question design

One request per note, ~10 questions batched against one state. The state is structured so the model sees facts we already know, not just text:

```jsonc
// state
{
  "note": {
    "title": "AI events in Indy",
    "path": null,
    "createdAt": "2026-07-08",
    "today": "2026-10-24",
    "source": "user",            // chatgpt | notion | agent | user
    "words": 1450,
    "links": 21, "backlinks": 0,
    "views30d": 0, "lastViewedAt": null,
    "inCollection": false,
    "datesMentioned": ["2026-07-14", "2026-11-18"],
    "body": "<first ~3k tokens of noteText(), headings kept>"
  }
}
```

### Per-note questions (one call)

| id | type | instructions (abridged) | options / levels |
| --- | --- | --- | --- |
| `time_bound` | choice | Is `note` about a specific moment that has passed relative to `note.today`? | `evergreen`, `time_bound_current`, `time_bound_expired`, `mixed_evergreen_core` |
| `generic` | noul | Could a person get the same content today by asking a general chatbot or searching once, with nothing specific to the author? | |
| `outdated` | score | How likely is the technical or factual content to be out of date? | `current` … `obsolete` (4) |
| `broken` | choice | Is anything broken? | `none`, `empty_or_stub`, `dead_links`, `import_artifacts`, `truncated`, `garbled` |
| `kind` | choice | What is this note mostly? | `reference`, `how_to`, `log`, `plan`, `idea`, `task`, `link_dump`, `chat_transcript`, `journal`, `list`, `hub_index` |
| `length_fit` | choice | Is the length doing work? | `too_thin`, `right`, `long_but_structural`, `long_and_padded` |
| `topic_count` | score | How many distinct, separable subjects does it cover? | `1`, `2`, `3–4`, `5+` |
| `should_split` | noul | Would two or more standalone notes be clearer than this one? | |
| `actionable` | noul | Is the main content a to-do the author hasn't done yet? | |
| `keep` | score | Overall, how worth keeping is this? | `delete`, `archive`, `keep_trimmed`, `keep` |

Cost: ~2–3k input tokens per note → ~3,000 notes × 2.5k = 7.5M tokens = **$0.32 Jev / $0.75 OpenAI** for the batched pass. Even with full-length notes at 32k tokens each, it's single-digit dollars.

### Pair questions (merge, related, naming)

Neither API compares documents natively, but `state` can hold two notes. Generate candidates from the embeddings we already keep current (`DocEmbedding`, refreshed after writes) and only ask about the top-k neighbors above a cosine floor:

```jsonc
{ "a": { "title": "...", "path": "css", "body": "..." },
  "b": { "title": "...", "path": "css", "body": "..." } }
```

| id | type | question |
| --- | --- | --- |
| `relation` | choice | `duplicate`, `same_topic_should_merge`, `related_keep_separate`, `unrelated` |
| `superset` | choice | `a_contains_b`, `b_contains_a`, `overlap`, `neither` |
| `merge_target` | choice | Which should survive? `a`, `b`, `new_note` |

At k=5 that's ~15k pair calls × ~4k tokens = 60M tokens ≈ **$2.50 Jev / $6 OpenAI**. Pairwise volume is where a decision model beats an LLM most clearly.

### Group and naming questions

For a cluster (UMAP region, path, or merge component):

- **"Is this a good name?"** Score the current title against the body (`misleading` … `precise`). Cheap to run on every note. Prod has many import-style titles (`house ref`, `js ts hoc`) that this would flag.
- **"Which name is best?"** An LLM proposes 3–5 titles or path names, then a `choice` picks one. Generation stays with the LLM, the decision model picks.
- **"Does this cluster hang together?"** Run a `noul` per member: "Does `member` belong with the others in `group`?" This finds outliers in a path or region, and it's a direct quality check on `UmapRun.regionsJson` labels.

## Pipeline

1. **Rules (free, deterministic).** Empty body with no audio or attachments. Hub pages (most blocks are links into its own subtree). `|||` star rows. ChatGPT `Link back:` transcripts. Exclude collection rows and event or place notes from cleanup.
2. **Per-note decision pass.** One batched call per note. Store results in a new table (e.g. `NoteAssessment { docId, contentHash, questionSetVersion, model, answers Json, createdAt }`) so re-runs skip unchanged notes. Re-assess on save through the same debounce as `embedding-refresh.ts`.
3. **Pair pass** over embedding neighbors, stored in `NotePairAssessment`.
4. **LLM actions only on the flagged set:** merge drafts, summaries, splits, new titles, through the existing `callLLM` and `LlmRequest` log.
5. **Review queue UI.** Buckets sorted by probability: "Probably delete", "Expired: keep the evergreen part?", "Merge these 4", "Turn into a task", "Rename". Accepting goes through `note-write.ts`. Delete stays a user action, matching the MCP rules. Every accept or reject is a label we can use to tune thresholds.

Steps 1–2 plus a read-only queue would answer "which of my notes are low value?" within a day of work. Write-back can come later.

## Other uses once the plumbing exists

- **Filing on save:** a `choice` over existing paths ("where does this go?"), with options from `notes_list_paths`. Most unfiled notes in the sample have an obvious home.
- **Agent note hygiene:** agents create many snapshot notes (insurance offers, outing lists). Ask "is this superseded by a newer note on the same subject?" and auto-label `snapshot as of`, which the MCP instructions already ask for.
- **Inline task detection:** `actionable` plus "is this already done?" against later notes.
- **Search reranking:** rerank keyword or semantic hits with `noul("does note answer query?")` at ~100 ms.
- **Tag and meta suggestion:** a `choice` over existing tags or meta values (`notes_list_tags`, `notes_list_meta_keys`).
- **MCP tool:** expose `notes_assess` so ChatGPT or Claude can call it for cleanup without reading every note in full.

## Risks and open questions

- **Privacy.** Every pass sends note bodies to a third party. OpenAI already sees them (embeddings, `callLLM`). TypeSafe would be a new processor. Decide whether journals, health, and finance paths are excluded.
- **Vendor choice.** OpenAI is the lower-friction start (key, logging, and billing already exist). Jev is cheaper, better documented, and has more independent benchmarks. Wrap both behind one `decide(state, questions)` helper so we can A/B on your own labels.
- **Calibration on our data.** Vendor calibration was measured on their tasks. Hand-label ~100 notes from the review queue before trusting thresholds for anything automatic.
- **`updatedAt` is polluted.** Treat the Oct 20 bulk rewrite as noise. Consider a `contentChangedAt` column that only content writes bump.
- **Unverified.** OpenAI's endpoint, context limit, and Batch API support come from secondary coverage. Read the official guide before building.

## Sources

- [VentureBeat: Jev offers a cheaper way](https://venturebeat.com/orchestration/companies-are-paying-llms-to-generate-text-for-decisions-that-only-need-a-label-jev-offers-a-cheaper-way)
- [Flavio Copes: typed decisions with Jev](https://flaviocopes.com/jev/) (request shape, limits, pricing)
- [OpenRouter: Jev vs LLM benchmarks](https://openrouter.ai/blog/tutorials/jev-vs-llm-when-to-use-each/)
- [Navya AI: Jev vs DIY LLM classifier](https://www.navyaai.com/blog/jev-typesafe-limitations-production)
- [Rao & Callison-Burch, arXiv 2609.29769](https://arxiv.org/abs/2609.29769) (decision models as rubric judges)
- [Firecrawl: OpenAI Decisions API vs Jev](https://www.firecrawl.dev/blog/openai-decisions-api-vs-jev)
- [CellCog: OpenAI Decisions API at GA](https://cellcog.ai/blog/openai-decisions-api/)
- [TechCrunch: OpenAI makes its Jev competitor widely available](https://techcrunch.com/2026/10/22/openai-makes-its-jev-competitor-widely-available-as-decision-model-competition-heats-up/)
- [OpenAI community: Decisions API public beta](https://community.openai.com/t/decisions-api-is-now-available-in-public-beta/1403877)
