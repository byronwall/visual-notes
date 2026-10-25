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
  const empty = words < 8 ? 0.95 : words < 25 ? 0.6 : 0.05;
  const junk =
    imported && linkLines / lines > 0.6
      ? 0.9
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
    worth_reading: { p: clamp(words < 25 ? 0.15 : 0.55 + ownVoice * 0.35) },
    title_fits: { p: clamp(/\s/.test(title.trim()) ? 0.8 : 0.4) },
  };
}

export const heuristicDecider: Decider = async ({ state }) => {
  const started = Date.now();
  const { facts, note } = state as {
    facts: NoteFacts;
    note: { title: string; body: string };
  };
  return {
    model: HEURISTIC_MODEL,
    answers: noteAnswers(facts, note.title, note.body),
    inputTokens: null,
    latencyMs: Date.now() - started,
  };
};
