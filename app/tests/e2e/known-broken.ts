// Specs that fail on main for a known reason. CI skips them; local runs
// still include them. Remove an entry in the PR that fixes the spec.
// Never add a spec here to get a PR green: fix it or mark the single case
// with `test.fixme` and a reason.
export const knownBrokenSpecs: Record<string, string> = {};
