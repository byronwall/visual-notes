import type { APIEvent } from "@solidjs/start/server";
import { organizationIcon } from "~/server/people/org-icon";

// No icon answers with an empty image, not a 404, so the monogram behind it
// shows and the browser logs no failed request.
const EMPTY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

export async function GET(event: APIEvent) {
  const id = String(event.params.id || "");
  const icon = id ? await organizationIcon(id) : null;
  if (!icon)
    return new Response(EMPTY, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "private, max-age=3600",
      },
    });
  return new Response(new Uint8Array(icon.data), {
    headers: {
      "content-type": icon.type,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
