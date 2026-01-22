import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { isRequestAuthenticated } from "~/server/magic-auth";

export type MagicSession = { authed: boolean };

export const fetchMagicSession = query(async (): Promise<MagicSession> => {
  "use server";
  const event = getRequestEvent();
  const authed = event ? isRequestAuthenticated(event.request) : false;
  return { authed };
}, "magic-session");
