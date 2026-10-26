// The commit this server was built from. The Docker build sets APP_COMMIT
// from the SOURCE_COMMIT build arg (Coolify passes it; docker compose reads
// it from the shell). Agents compare it with a merge SHA to tell whether
// production has deployed a change.
export const buildCommit = process.env.APP_COMMIT?.trim() || "unknown";

export const serverStartedAt = new Date().toISOString();
