import type { Answers } from "./decide";
import type { NoteFacts } from "./note-state";
import { p } from "./buckets";

/**
 * Short "why it is here" chips for one assessment. Pure, so the triage
 * panel and tests share it.
 */

export type Signal = { label: string; tone: "strong" | "neutral" };

const SOURCE_LABELS: Record<NoteFacts["source"], string | null> = {
  chatgpt_transcript: "Source: ChatGPT transcript",
  notion_import: "Source: Notion import",
  agent: "Source: written by an agent",
  user: null,
};

const pct = (value: number) => value.toFixed(2);

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function signalsFor(
  bucket: string,
  facts: NoteFacts,
  answers: Answers,
): Signal[] {
  const out: Signal[] = [];
  const add = (label: string, tone: Signal["tone"] = "neutral") =>
    out.push({ label, tone });

  if (bucket === "distill") {
    add(
      `Copied or generated ${pct(p(answers, "copied_or_generated"))}`,
      "strong",
    );
  }
  if (bucket === "post_event" && facts.latestDateInBody) {
    add(`Date passed: ${longDate(facts.latestDateInBody)}`, "strong");
    add(
      p(answers, "evergreen_core") >= 0.4
        ? "Has a reusable part"
        : "Nothing reusable found",
    );
  }
  if (bucket === "make_task") {
    add(`Reads as a to-do ${pct(p(answers, "is_todo"))}`, "strong");
  }
  if (bucket === "delete") {
    const stub = p(answers, "empty_or_stub");
    const junk = p(answers, "import_junk");
    if (stub >= junk && stub > 0.5) add(`Empty or stub ${pct(stub)}`, "strong");
    else if (junk > 0.5) add(`Import leftovers ${pct(junk)}`, "strong");
    else
      add(
        `Not worth reading ${pct(1 - p(answers, "worth_reading"))}`,
        "strong",
      );
  }
  const source = SOURCE_LABELS[facts.source];
  if (source) add(source);
  if (facts.views30d === 0) add("No views in 30 days");
  if (bucket !== "delete" && p(answers, "author_specific") >= 0.6) {
    add("Has your own notes");
  }
  return out;
}
