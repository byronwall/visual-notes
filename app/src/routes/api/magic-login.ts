import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { serverEnv } from "~/env/server";
import { buildAuthCookie, issueMagicToken } from "~/server/magic-auth";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const inputPassword = String(body?.password ?? "");
    if (!inputPassword) {
      console.log("[magic-login] missing password body");
      return json({ error: "Password required" }, { status: 400 });
    }
    const expected = serverEnv.MAGIC_PASSWORD;
    if (inputPassword !== expected) {
      console.log("[magic-login] password mismatch");
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = issueMagicToken();
    const setCookie = buildAuthCookie(token);
    console.log("[magic-login] issuing token and setting cookie");
    return json({ ok: true }, { headers: { "Set-Cookie": setCookie } });
  } catch (e) {
    const msg = (e as Error).message || "Invalid request";
    console.log("[magic-login] error", msg);
    return json({ error: msg }, { status: 400 });
  }
}
