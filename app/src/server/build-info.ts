// The commit this server runs. Coolify sets SOURCE_COMMIT at runtime; docker
// compose reads it from the shell. Agents compare it with a merge SHA to tell
// whether production has deployed a change.
export const buildCommit = process.env.SOURCE_COMMIT?.trim() || "unknown";

export const serverStartedAt = new Date().toISOString();
