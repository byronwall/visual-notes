import type { Answers } from "./decide";
import type { NoteFacts } from "./note-state";

/**
 * Combines atomic answers into one suggested bucket in code. The experiment
 * showed a holistic "what should I do?" question can't find the distill
 * queue (AUC ~0.5) while `copied_or_generated` alone ranks it at ~0.92.
 * Thresholds are placeholders until review decisions tune them; nothing here
 * acts on a note, it only picks the queue and its sort key.
 */

export const CLEANUP_BUCKETS = [
  "distill",
  "regroup",
  "post_event",
  "make_task",
  "revisit_link",
  "delete",
  "keep",
] as const;

export type CleanupBucket = (typeof CLEANUP_BUCKETS)[number];

export type BucketResult = {
  bucket: CleanupBucket;
  /** Probability behind the bucket; the queue sorts on it, highest first. */
  confidence: number;
};

export const THRESHOLDS = {
  problem: 0.7,
  expiredAnchor: 0.6,
  todo: 0.8,
  distill: 0.6,
  notWorthReading: 0.75,
} as const;

export const p = (answers: Answers, id: string): number => {
  const a = answers[id];
  return a && "p" in a ? a.p : 0;
};

const prob = (answers: Answers, id: string, key: string): number => {
  const a = answers[id];
  return a && "probs" in a ? a.probs[key] ?? 0 : 0;
};

/** Queue order for breadcrumbs: links that load first, then unsure ones. */
const LINK_CONFIDENCE = { ok: 0.8, blocked: 0.6, unchecked: 0.5 } as const;

export function bucketFor(facts: NoteFacts, answers: Answers): BucketResult {
  // A saved link is a breadcrumb, not a stub: delete it only when the link
  // is gone. Otherwise it waits in revisit_link to be expanded or checked.
  if (facts.linkUrl) {
    if (facts.link?.status === "dead") {
      return { bucket: "delete", confidence: 0.95 };
    }
    return {
      bucket: "revisit_link",
      confidence: LINK_CONFIDENCE[facts.link?.status ?? "unchecked"],
    };
  }

  // "Wrong" flags combine with max, not average.
  const problem = Math.max(
    p(answers, "empty_or_stub"),
    p(answers, "import_junk"),
  );
  if (problem > THRESHOLDS.problem) {
    return { bucket: "delete", confidence: problem };
  }

  const dated =
    prob(answers, "time_anchor", "one_event") +
    prob(answers, "time_anchor", "period_plan");
  if (facts.latestDateIsPast && dated > THRESHOLDS.expiredAnchor) {
    return { bucket: "post_event", confidence: dated };
  }

  const todo = p(answers, "is_todo");
  if (todo >= THRESHOLDS.todo) return { bucket: "make_task", confidence: todo };

  // Distill ranks on the one signal that found Byron's trim queue, nudged up
  // for ChatGPT transcripts (the strongest code fact).
  const copied = p(answers, "copied_or_generated");
  if (copied >= THRESHOLDS.distill) {
    const boost = facts.source === "chatgpt_transcript" ? 0.03 : 0;
    return { bucket: "distill", confidence: Math.min(1, copied + boost) };
  }

  const notWorth = 1 - p(answers, "worth_reading");
  if (
    notWorth >= THRESHOLDS.notWorthReading &&
    p(answers, "author_specific") < 0.3
  ) {
    return { bucket: "delete", confidence: notWorth };
  }

  return { bucket: "keep", confidence: 1 - copied };
}
