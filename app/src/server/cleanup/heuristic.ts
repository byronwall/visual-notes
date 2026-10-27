import type { Answers, Decider } from "./decide";
import { HEURISTIC_MODEL } from "./decide";
import type { NoteFacts } from "./note-state";

/**
 * Rough answers from facts and surface patterns, for runs without a vendor
 * key (local dev, audit databases, tests). Rankings are only as good as the
 * rules here; results carry the `heuristic-v1` model name.
 */

const clamp = (p: number) => Math.min(0.97, Math.max(0.03, p));

function noteAnswers(facts: NoteFacts, title: string, body: string): Answers {
  const words = facts.words;
  const chatgpt = facts.source === "chatgpt_transcript";
  const imported = facts.source === "notion_import";
  const firstPerson = (body.match(/\b(I|I'm|I've|my|we|our)\b/g) ?? []).length;
  const ownVoice = Math.min(1, firstPerson / Math.max(8, words / 40));
  const checkboxes = (body.match(/^\s*[-*] \[ \]/gm) ?? []).length;
  const linkLines = (body.match(/^\s*[-*]?\s*\[[^\]]*\]\([^)]*\)\s*$/gm) ?? [])
    .length;
  const lines = body.split("\n").filter((l) => l.trim()).length || 1;
  const eventWords =
    /\b(trip|camp|camping|appointment|rsvp|carpool|itinerary|event|party|tickets?|quote)\b/i;
  const dated = facts.latestDateIsPast === true;
  const eventLike = dated && eventWords.test(`${title}\n${body}`);
  const evergreen =
    /\b(packing list|contacts?|lessons?|next time|checklist)\b/i;

  const copied = chatgpt
    ? 0.92
    : facts.source === "agent"
      ? 0.75
      : 0.25 - ownVoice * 0.2;
  // A saved link is not a stub (see the v2 empty_or_stub wording).
  const empty = facts.linkUrl
    ? 0.1
    : words < 8
      ? 0.95
      : words < 25
        ? 0.6
        : 0.05;
  // Mostly links to other pages (Notion hubs) or delimiter rows.
  const junk =
    linkLines / lines > 0.6
      ? imported
        ? 0.92
        : 0.85
      : body.includes("|||")
        ? 0.85
        : 0.05;
  const todo = checkboxes > 0 && checkboxes / lines > 0.5 ? 0.88 : 0.08;
  const anchorChoice = eventLike
    ? "one_event"
    : dated
      ? "dated_log"
      : "ongoing_reference";

  return {
    copied_or_generated: { p: clamp(copied) },
    author_specific: { p: clamp(0.2 + ownVoice * 0.75 - (chatgpt ? 0.15 : 0)) },
    rederivable: { p: clamp(chatgpt ? 0.8 : 0.5 - ownVoice * 0.4) },
    time_anchor: {
      choice: anchorChoice,
      probs: {
        ongoing_reference: anchorChoice === "ongoing_reference" ? 0.8 : 0.1,
        one_event: anchorChoice === "one_event" ? 0.8 : 0.05,
        period_plan: 0.05,
        dated_log: anchorChoice === "dated_log" ? 0.75 : 0.05,
        other: 0.05,
      },
    },
    evergreen_core: {
      p: clamp(eventLike ? (evergreen.test(body) ? 0.75 : 0.2) : 0.9),
    },
    empty_or_stub: { p: clamp(empty) },
    import_junk: { p: clamp(junk) },
    is_todo: { p: clamp(todo) },
    worth_reading: {
      p: clamp(
        words < 8 ? 0.1 : 0.55 + ownVoice * 0.35 - (words < 25 ? 0.15 : 0),
      ),
    },
    title_fits: { p: clamp(/\s/.test(title.trim()) ? 0.8 : 0.4) },
  };
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "notes",
  "note",
  "from",
  "that",
  "this",
  "how",
]);

/** Lowercase title words worth comparing (3+ letters, not stop words). */
export const titleWords = (title: string) =>
  new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );

const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
};

type PairNote = { title: string; body: string };

function pairAnswers(a: PairNote, b: PairNote): Answers {
  const shared = overlap(titleWords(a.title), titleWords(b.title));
  const level =
    shared >= 0.6
      ? "same_problem"
      : shared >= 0.3
        ? "same_area"
        : "shares_words_only";
  const covers = (x: PairNote, y: PairNote) =>
    clamp(x.body.length > y.body.length * 2 ? 0.6 : 0.2);
  return {
    relation: {
      label: level,
      probs: {
        shares_words_only: level === "shares_words_only" ? 0.7 : 0.1,
        same_area: level === "same_area" ? 0.7 : 0.15,
        same_problem: level === "same_problem" ? 0.7 : 0.1,
        same_content: 0.05,
      },
    },
    a_covers_b: { p: covers(a, b) },
    b_covers_a: { p: covers(b, a) },
    better_together: { p: clamp(0.15 + shared * 0.8) },
  };
}

function placementAnswer(note: PairNote, options: string[]): Answers {
  const words = titleWords(`${note.title} ${note.body.slice(0, 2000)}`);
  const scored = options
    .filter((key) => key !== "other")
    .map((key) => {
      const name = key.split(":").slice(1).join(":");
      const hits = [...titleWords(name.replace(/\./g, " "))].filter((w) =>
        words.has(w),
      ).length;
      return { key, hits };
    })
    .sort((x, y) => y.hits - x.hits);
  const best = scored[0]?.hits ? scored[0].key : "other";
  const probs = Object.fromEntries(
    options.map((k) => [k, k === best ? 0.7 : 0.3 / options.length]),
  );
  return { placement: { choice: best, probs } };
}

export const heuristicDecider: Decider = async ({ state, questions }) => {
  const started = Date.now();
  const ids = new Set(questions.map((q) => q.id));
  let answers: Answers;
  if (ids.has("better_together")) {
    const { a, b } = state as { a: PairNote; b: PairNote };
    answers = pairAnswers(a, b);
  } else if (ids.has("placement")) {
    const question = questions.find((q) => q.id === "placement");
    const options =
      question?.type === "choice" ? question.options.map(([k]) => k) : [];
    answers = placementAnswer((state as { note: PairNote }).note, options);
  } else {
    const { facts, note } = state as { facts: NoteFacts; note: PairNote };
    answers = noteAnswers(facts, note.title, note.body);
  }
  return {
    model: HEURISTIC_MODEL,
    answers,
    inputTokens: null,
    latencyMs: Date.now() - started,
  };
};
