// The commit this server runs. Coolify sets SOURCE_COMMIT at runtime through
// the .env it gives each compose service. Agents compare it with a merge SHA to tell
// whether production has deployed a change.
export const buildCommit = process.env.SOURCE_COMMIT?.trim() || "unknown";

export const serverStartedAt = new Date().toISOString();
