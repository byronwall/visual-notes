import { token, type Token } from "styled-system/tokens";

/** Display metadata for the cleanup buckets the triage page can act on. */

export type BucketId =
  | "distill"
  | "regroup"
  | "post_event"
  | "make_task"
  | "delete";

export type BucketMeta = {
  label: string;
  /** Panda color token for the bucket dot (read as a CSS variable). */
  dot: string;
  blurb: string;
};

export const BUCKET_META: Record<BucketId, BucketMeta> = {
  distill: {
    label: "Distill",
    dot: "amber.9",
    blurb:
      "Mostly copied or generated. Keep the durable facts, archive the rest.",
  },
  regroup: {
    label: "Regroup",
    dot: "green.9",
    blurb:
      "Related notes that read better as one, or a note that belongs in a collection.",
  },
  post_event: {
    label: "Post-event",
    dot: "gray.9",
    blurb: "The date has passed. Keep the reusable part, archive the rest.",
  },
  make_task: {
    label: "Make task",
    dot: "blue.9",
    blurb: "Really a to-do. Turn it into a task and archive the note.",
  },
  delete: {
    label: "Delete",
    dot: "red.9",
    blurb:
      "Empty, a stub, or import leftovers. Archive it; it deletes in 30 days.",
  },
};

/** Buckets shown in the rail, in order. Each needs an action panel. */
export const RAIL_BUCKETS: BucketId[] = ["distill", "regroup"];

export const dotColor = (color: string) =>
  token.var(`colors.${color}` as Token);

export const isBucketId = (value: unknown): value is BucketId =>
  typeof value === "string" && value in BUCKET_META;
