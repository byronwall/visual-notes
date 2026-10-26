import { action } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { clearAuthCookie } from "~/server/magic-auth";
import { loginWithMagicPassword } from "./magic-login";

export const magicLogin = action(loginWithMagicPassword, "magic-login");

export const magicLogout = action(async () => {
  "use server";
  const setCookie = clearAuthCookie();
  const event = getRequestEvent();
  if (event) event.response.headers.append("Set-Cookie", setCookie);
  return { ok: true };
}, "magic-logout");
