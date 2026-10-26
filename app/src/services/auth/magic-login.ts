import { getRequestEvent } from "solid-js/web";
import { z } from "zod";
import { serverEnv } from "~/env/server";
import { buildAuthCookie, issueMagicToken } from "~/server/magic-auth";

const loginInput = z.object({
  password: z.string().min(1),
});

// Public: the middleware lets this run without a session (public-server-fns.ts).
// Outside magic-auth.actions.ts so server code can import it.
export const loginWithMagicPassword = async (
  payload: z.infer<typeof loginInput>,
) => {
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
};
