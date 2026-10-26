import { buildCommit, serverStartedAt } from "~/server/build-info";

// Public, so a deploy check needs no sign-in: `curl <site>/api/version`.
export function GET() {
  return Response.json(
    { commit: buildCommit, startedAt: serverStartedAt },
    { headers: { "cache-control": "no-store" } },
  );
}
