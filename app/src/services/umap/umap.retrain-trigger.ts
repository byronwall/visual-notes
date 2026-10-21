const DAY_MS = 24 * 60 * 60_000;

/** When the sweep retrains the canvas map instead of projecting into it. */
export const UMAP_RETRAIN_CONFIG = {
  /** Retrain once notes projected since training reach this share of the map. */
  minNewFraction: 0.2,
  /** ...and at least this many, so a tiny map doesn't retrain on every note. */
  minNewNotes: 5,
  /** Retrain a map this old... */
  maxAgeDays: 30,
  /** ...once it has at least this many projected notes. */
  minNewNotesForAge: 10,
} as const;

export type UmapRetrainConfig = {
  [Key in keyof typeof UMAP_RETRAIN_CONFIG]: number;
};

export type RetrainDecision = {
  retrain: boolean;
  reason: "drift" | "age" | "fresh";
  newNotes: number;
  totalNotes: number;
  ageDays: number;
};

/**
 * Counts notes added since training as points beyond the trained count.
 * Deleted notes drop their points, so this undercounts after deletions,
 * which only delays a retrain.
 */
export function decideUmapRetrain(
  run: { trainedDocCount: number | null; pointCount: number; createdAt: Date },
  now: Date,
  config: UmapRetrainConfig = UMAP_RETRAIN_CONFIG,
): RetrainDecision {
  const totalNotes = run.pointCount;
  const newNotes = Math.max(
    0,
    totalNotes - (run.trainedDocCount ?? totalNotes),
  );
  const ageDays = Math.max(
    0,
    (now.getTime() - run.createdAt.getTime()) / DAY_MS,
  );
  const base = { newNotes, totalNotes, ageDays };
  if (
    totalNotes > 0 &&
    newNotes >= config.minNewNotes &&
    newNotes / totalNotes >= config.minNewFraction
  ) {
    return { ...base, retrain: true, reason: "drift" };
  }
  if (ageDays >= config.maxAgeDays && newNotes >= config.minNewNotesForAge) {
    return { ...base, retrain: true, reason: "age" };
  }
  return { ...base, retrain: false, reason: "fresh" };
}
