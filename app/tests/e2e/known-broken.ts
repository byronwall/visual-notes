// Specs that fail on main for a known reason. CI skips them; local runs
// still include them. Remove an entry in the PR that fixes the spec.
// Never add a spec here to get a PR green: fix it or mark the single case
// with `test.fixme` and a reason.
export const knownBrokenSpecs: Record<string, string> = {
  homepage: "stale after the October UI redesign; repaired in #148",
  "task-lists": "stale after the October UI redesign; repaired in #148",
  "time-blocks-interactions":
    "stale after the redesign, plus the swallowed click after a cross-day drag; repaired in #148",
  "time-blocks-layout": "stale after the October UI redesign; repaired in #148",
};
