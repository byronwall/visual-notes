import { action } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { z } from "zod";
import { serverEnv } from "~/env/server";
import {
  buildAuthCookie,
  clearAuthCookie,
  issueMagicToken,
} from "~/server/magic-auth";

const loginInput = z.object({
  password: z.string().min(1),
});

export const magicLogin = action(
  async (payload: z.infer<typeof loginInput>) => {
    "use server";
    const parsed = loginInput.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Password required");
    }
    if (parsed.data.password !== serverEnv.MAGIC_PASSWORD) {
      console.log("[magic-login] password mismatch");
      throw new Error("Unauthorized");
    }
    const token = issueMagicToken();
    const setCookie = buildAuthCookie(token);
    const event = getRequestEvent();
    if (event) event.response.headers.append("Set-Cookie", setCookie);
    console.log("[magic-login] issuing token and setting cookie");
    return { ok: true };
  },
  "magic-login"
);

export const magicLogout = action(async () => {
  "use server";
  const setCookie = clearAuthCookie();
  const event = getRequestEvent();
  if (event) event.response.headers.append("Set-Cookie", setCookie);
  return { ok: true };
}, "magic-logout");
