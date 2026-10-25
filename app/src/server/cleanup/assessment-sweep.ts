const LOG_PREFIX = "[cleanup-sweep]";
const SAVE_DEBOUNCE_MS = 60_000;
const SWEEP_INTERVAL_MS = 6 * 60 * 60_000;
/** Notes per pass; a full first pass over ~6k notes spreads across passes. */
const BATCH = 200;
const MAX_FOLLOW_UPS = 40;

const SWEEP_TIMER_KEY = Symbol.for("visual-notes.cleanup-sweep");
type SweepGlobal = typeof globalThis & {
  [SWEEP_TIMER_KEY]?: ReturnType<typeof setInterval>;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let pendingAfterRun = false;

function unref(handle: unknown) {
  (handle as { unref?: () => void }).unref?.();
}

/**
 * Re-assesses changed notes a minute after the last write. Safe to call from
 * inside a write: it only arms a timer and loads the assessor lazily.
 */
export function scheduleCleanupAssessment(): void {
  if (running) {
    pendingAfterRun = true;
    return;
  }
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void runPass();
  }, SAVE_DEBOUNCE_MS);
  unref(timer);
}

async function runPass() {
  if (running) return;
  running = true;
  try {
    const { assessStaleNotes, assessStalePairsNow } = await import("./assess");
    for (let pass = 0; pass <= MAX_FOLLOW_UPS; pass += 1) {
      const result = await assessStaleNotes(BATCH);
      if (!result.provider || result.assessed + result.failed < BATCH) break;
      // A pass of only failures means the vendor is down; wait for the next sweep.
      if (!result.assessed) break;
    }
    // Regroup pairs need the notes assessed first.
    for (let pass = 0; pass <= MAX_FOLLOW_UPS; pass += 1) {
      const { checked } = await assessStalePairsNow(BATCH);
      if (checked < BATCH) break;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} pass failed`, error);
  } finally {
    running = false;
    if (pendingAfterRun) {
      pendingAfterRun = false;
      scheduleCleanupAssessment();
    }
  }
}

/** One pass soon after boot, then every six hours. Skips in tests. */
export function startCleanupSweep(): void {
  if (process.env.NODE_ENV === "test") return;
  const store = globalThis as SweepGlobal;
  const previous = store[SWEEP_TIMER_KEY];
  if (previous) clearInterval(previous);
  const interval = setInterval(() => void runPass(), SWEEP_INTERVAL_MS);
  unref(interval);
  store[SWEEP_TIMER_KEY] = interval;
  if (previous) return;
  console.info(`${LOG_PREFIX} sweep started`);
  scheduleCleanupAssessment();
}
