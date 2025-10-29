import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { clearAuthCookie } from "~/server/magic-auth";

export async function POST(_event: APIEvent) {
  const setCookie = clearAuthCookie();
  return json({ ok: true }, { headers: { "Set-Cookie": setCookie } });
}
