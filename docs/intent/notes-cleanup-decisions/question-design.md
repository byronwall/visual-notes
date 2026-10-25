# Question design v1: note cleanup with decision models

This is the spec for the experiment in [research.md](research.md). It revises the first-draft question set using the published prompting guidance for both APIs and two community skills. Each change is tied to the rule behind it.

## Sources used

- **OpenAI Decisions guide** ([developers.openai.com](https://developers.openai.com/api/docs/guides/decisions)): observable criteria, one concern per question, explicit exclusions, a fallback choice, distinct adjacent score levels, `input_json`, prefix caching on shared `input`.
- **TypeSafe jev-1.13 jaggedness page** ([docs.typesafe.ai](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)): known weak spots.
- **`building-with-typesafe-jev`** (community skill, MIT, [aaddrick/building-with-typesafe-jev](https://github.com/aaddrick/building-with-typesafe-jev)): rules, how to read the numbers, a common-mistakes table, and the judges and ranking prior art.
- **`akc-cycle`: `jev-judgment-design` and `author-calibrated-eval`** ([shimo4228/akc-cycle](https://github.com/shimo4228/akc-cycle)): put the comparison target in state, give "only shares vocabulary" its own bottom tier, keep the gate separate from the ranking, canaries, and the author as ground truth.
- **Pushback** ([pjburnhill gist](https://gist.github.com/pjburnhill/adf8d28efcad9df037bfdece178ef965)): literal reading, option order, stating how to treat missing evidence.

## Rules that changed the draft

| Rule | Where it came from | What it changed |
| --- | --- | --- |
| **No holistic judge.** "Is this good?" scored 0.56 agreement, while per-field checks scored 0.95 and 0.85 | jev skill, judges | Dropped the `keep` score. Keep/archive/delete is computed in code from atomic flags |
| **Dates, ordering, counting, and math go in code** | jaggedness page, jev rule 10 | Dropped "has this passed relative to `today`?" Code pulls dates out and compares them. Jev only says *whether* the note is anchored to a date |
| **Count in code, one Noul per candidate** | jev rule 10 | Dropped the `topic_count` score. Code splits the note into sections, asks one Noul per section, and sums |
| **Score levels are situations, not adjectives** | both guides | Rewrote `outdated` and `length_fit` as concrete situations |
| **Noul: high means yes, no negations** | jev rule 9, jaggedness | Flipped `generic` to `author_specific` (high = specific to Byron) |
| **Choice always picks a winner, so add `other` and an absolute Noul** | OpenAI guide, jev | Every Choice has `other`. `kind` is paired with `is_note_worth_reading` |
| **Choices lean toward the first option** | jaggedness, gist | Options are frozen per version. The dev set runs once with options reversed to measure stability |
| **Put the comparison target in state** | jev-judgment-design §2 | "Generic" and "specific" mean nothing without knowing who the author is. Added an `owner` profile to state |
| **"Only shares vocabulary" is its own bottom tier** | jev-judgment-design §3 | The pair `relation` score starts at `shares_words_only` |
| **The gate is separate from the ranking** | jev-judgment-design §4 | Nouls can only drop or flag. Scores only rank within a bucket |
| **Untrusted text goes in its own named field** | jev skill | The note body lives at `note.body`, and questions point at it by path. Many bodies are pasted ChatGPT output |
| **Send only what the question needs** | all sources | Code-computed facts go in their own fields. The body is capped at ~6k tokens, using head plus tail with a `truncated` flag |
| **Combine "wrong" flags with max, not average** | jev skill | `problem = max(empty, import_junk, dead_ref)` |
| **The author is ground truth for taste** | author-calibrated-eval | Labels come from Byron's blind read, not an LLM judge |

## State shape (shared by every per-note question)

```jsonc
{
  "owner": {
    "about": "Byron: senior full-stack developer in Indianapolis; family with young kids; house projects, woodworking, data viz, stats, Bible study.",
    "keeps": "Personal decisions, logs of what was done, project notes, hard-won fixes, things he wrote himself.",
    "drops": "Generic explanations anyone could re-ask a chatbot for, expired plans, empty captures, import leftovers."
  },
  "facts": {                       // computed in code, stated as facts
    "source": "chatgpt_transcript", // chatgpt_transcript | notion_import | agent | user
    "path": "css",
    "created": "2025-05-16",
    "words": 1278,
    "sections": 9,
    "links": 1, "backlinks": 0, "views_30d": 0,
    "latest_date_in_body": "2025-05-16",
    "latest_date_is_past": true,     // compared in code
    "truncated": false
  },
  "note": { "title": "CSS Animations and Transitions", "body": "…" }
}
```

On OpenAI, `owner` goes in a fixed developer message first, so it can be served from the prefix cache. The rest goes in an `input_json` part. On Jev the whole object is `state`.

## Per-note questions (one request per note)

Instructions are written in full because question ids never reach the model. The criteria wording is v1, frozen once the experiment starts.

| id | type | instructions | options / levels |
| --- | --- | --- | --- |
| `author_specific` | noul | Does `note.body` contain something specific to `owner`: his own decisions, measurements, logs, plans, opinions, or results? A question he asked or a link he saved does not count by itself. | |
| `rederivable` | noul | Could a person get the useful content of `note.body` today with one general web search or chatbot question, with nothing lost? | |
| `time_anchor` | choice | What is `note.body` mainly organized around? | `ongoing_reference` (useful any time), `one_event` (a trip, outing, appointment, or purchase that happens once), `period_plan` (plans or quotes for a specific window), `dated_log` (a running record of past dated entries), `other` |
| `evergreen_core` | noul | If `note.body` is about a dated event or plan, does it also contain information that would still be useful after that date, such as a packing list, contacts, lessons, or recurring sources? If it is not about a dated event, answer yes. | |
| `tech_staleness` | score | If `note.body` gives technical advice about tools, libraries, or APIs, which describes it? | `no_technical_advice`, `advice_on_tools_still_standard`, `mentions_some_tools_now_replaced`, `centers_on_tools_now_replaced_or_abandoned` |
| `empty_or_stub` | noul | Is `note.body` empty, a title with no content, or a single link or line with no explanation? | |
| `import_junk` | noul | Is most of `note.body` leftover formatting from an import, such as delimiter rows (`\|\|\|`), lists of links to other pages, or metadata lines, rather than readable content? | |
| `kind` | choice | What is `note.body` mostly? | `reference`, `how_to`, `log`, `plan`, `idea`, `todo`, `link_collection`, `chat_transcript`, `journal`, `list`, `other` |
| `length_fit` | score | Which describes how `note.body` uses its length? | `too_little_to_be_useful`, `short_and_complete`, `long_because_of_many_entries_or_rows`, `long_with_repetition_or_chat_filler` |
| `is_todo` | noul | Is the main content of `note.body` one or a few things `owner` intends to do but has not recorded as done? | |
| `is_note_worth_reading` | noul | Would `owner` learn or recall something useful by reading `note.body` today? | |
| `title_fits` | noul | Does `note.title` tell a reader what `note.body` is about, without opening it? | |

Questions that were dropped or moved:

- **`keep`:** derived in code (below).
- **`topic_count` / `should_split`:** moved to a section pass (below).
- **`outdated` (general):** split into `tech_staleness` (judgeable) and `facts.latest_date_is_past` (code).

### Section pass (split detection)

Code splits the body on H1/H2 headings, or on blank-line paragraphs when there are no headings, keeping up to 12 sections. One request per note with state `{note: {title, sections: [...]}}`, plus questions for each section *i*:

- `same_subject_i` (noul): Is `` `note.sections[i]` `` about the same subject as `note.title`?
- `standalone_i` (noul): Would `` `note.sections[i]` `` make sense as its own note to someone who had not read the rest?

Code: `split_candidate = count(!same_subject_i && standalone_i) >= 2`.

## Decisions computed in code

```text
problem   = max(empty_or_stub, import_junk)                       # any flag = something wrong
expired   = facts.latest_date_is_past && P(time_anchor ∈ {one_event, period_plan}) > 0.6
value     = mean(author_specific, is_note_worth_reading, 1 − rederivable)   # ranking only

bucket:
  problem > 0.7                       → "Probably delete" (sorted by problem)
  expired && evergreen_core < 0.4     → "Expired: archive"
  expired && evergreen_core ≥ 0.4     → "Expired: keep the evergreen part" (LLM trims)
  is_todo > 0.7                       → "Make it a task"
  rederivable > 0.7 && author_specific < 0.3 → "Generic: archive"
  length_fit ≈ long_with_filler       → "Condense" (LLM summarizes)
  split_candidate                     → "Split"
  !title_fits                         → "Rename" (naming flow below)
  else                                → keep (sorted by value, lowest first, for a skim)
```

Thresholds are placeholders until the labeled set sets them. Nothing is acted on automatically. Every bucket is a review queue.

## Pair questions (merge and related)

The shortlist comes from code: top-5 embedding neighbors with cosine ≥ a floor, the same path or a sibling path preferred. Cheap keys are applied first (same `originalSource` thread, same title stem). State is `{owner, a: {title, path, created, body}, b: {…}}`, with each body capped at ~3k tokens.

| id | type | instructions | options / levels |
| --- | --- | --- | --- |
| `relation` | score | How do `a` and `b` relate? | `shares_words_only` (different problems that happen to share vocabulary), `same_area_different_problem`, `same_problem_different_angle`, `same_content_mostly_repeated` |
| `a_covers_b` | noul | Is everything useful in `b.body` also present in `a.body`? | |
| `b_covers_a` | noul | Is everything useful in `a.body` also present in `b.body`? | |
| `better_together` | noul | Would `owner` be better served by one note combining `a` and `b` than by two separate notes? | |

`relation` levels are named as outcomes, so `OUTCOME[round(score)]` routes without a threshold. The cover Nouls choose the survivor: if `a_covers_b` is high and `b_covers_a` is low, keep `a`. Superset detection stays as two directional Nouls rather than one Choice, because Choice probabilities are relative.

## Naming flow

1. Run `title_fits` on every note (included in the per-note request).
2. For notes that fail, an LLM proposes 4 titles in the house style (for example, `Replace bathroom exhaust fan motor`).
3. Jev runs a Choice over `{current, c1…c4, other}` with the instruction "Which title best tells a reader what `note.body` is about?". Option descriptions hold the candidate text and the keys hide the order. If `current` wins, nothing changes.
4. For groups (a path, a UMAP region, a merge cluster), ask one Noul per member: "Does `member` belong under the label `group.name`, given `group.description`?". Outliers get a re-file suggestion: a Choice over existing paths, walked by beam search over the path tree (jev skill: ranking, *walk*).

## Experiment protocol

1. **Gold set:** ~150 sampled notes, stratified by archetype. Assign each to dev or holdout with `hash(id) % 3 == 0 → holdout`, so membership never moves.
2. **Byron labels ~60** (all of holdout plus some of dev): keep / archive / delete / merge-with / make-task, plus a one-word reason. The reasons feed the next criteria wording.
3. **Canaries:** 5 notes that must come out "keep" (`house wiring`, `House Work Timeline`, a journal with math, `Replace bathroom exhaust fan motor`, a woodworking build note) and 5 that must come out "delete" (blank voice note, the `js` Notion hub, a `|||` stub, …). Check them on every run. If a canary flips, suspect state before thresholds.
4. **Same questions to both vendors** through one adapter: Jev `noul/choice/score + criteria` and OpenAI `predicate/choice/score + choices/levels`. Log `response.model`, `usage.input_tokens`, and latency. Pin `jev-1.13.0`.
5. **Order-stability check:** run every Choice on dev a second time with options reversed. Flag any question whose argmax flips on more than 10% of notes, and fix its criteria before comparing vendors.
6. **Wording changes are code changes:** keep questions in one constants module with a `QUESTION_SET_VERSION`. Before adopting a rewording, diff which dev rows flip.
7. **Metrics:** per-question agreement with labels, bucket precision on holdout, calibration (accuracy by probability decile), cost per 1k notes, and p50/p95 latency.
8. **LLM baseline:** the same atomic questions answered by a small OpenAI model in JSON mode, to see whether the decision API beats it on accuracy, not only cost.

Budget: about 150 notes × (1 per-note + 1 section + about 2 pair) requests × 2 vendors × 2 order variants is about 1,200 requests. At about 4k tokens each that is about 5M tokens: about **$0.25 Jev, $0.50 OpenAI**. Keep Jev under about 8 concurrent workers.
