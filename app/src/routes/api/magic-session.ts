import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { isRequestAuthenticated } from "~/server/magic-auth";

export async function GET(event: APIEvent) {
  const authed = isRequestAuthenticated(event.request);
  return json({ authed });
}
