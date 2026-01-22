import { createHash } from "crypto";
import { getRequestEvent } from "solid-js/web";
import { MAGIC_COOKIE_NAME, parseCookie } from "~/server/magic-auth";

export function getMagicUserIdFromRequest(request: Request): string {
  const cookies = parseCookie(request.headers.get("cookie"));
  const token = cookies[MAGIC_COOKIE_NAME] || "anonymous";
  const hash = createHash("sha256").update(token).digest("hex");
  return `magic_${hash.slice(0, 24)}`;
}

export function getMagicUserIdFromEvent(): string {
  const event = getRequestEvent();
  if (!event) return "magic_anonymous";
  return getMagicUserIdFromRequest(event.request);
}
