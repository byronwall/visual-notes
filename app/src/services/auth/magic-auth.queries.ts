import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { isRequestAuthenticated } from "~/server/magic-auth";

export type MagicSession = { authed: boolean };

// Public: the middleware lets this run without a session (public-server-fns.ts).
export const getMagicSession = async (): Promise<MagicSession> => {
  "use server";
  const event = getRequestEvent();
  const authed = event ? isRequestAuthenticated(event.request) : false;
  return { authed };
};

export const fetchMagicSession = query(getMagicSession, "magic-session");
