import { createSignal } from "solid-js";
import type { PersonRef } from "~/lib/people/types";

export type CaptureMode = "fact" | "interaction";

export type CaptureRequest = {
  mode: CaptureMode;
  /** People to preselect, e.g. the profile the capture started from. */
  people: PersonRef[];
};

// One capture dialog for the app; profile buttons and the command palette
// open it through this signal, and PeopleCaptureHost renders it.
const [captureRequest, setCaptureRequest] = createSignal<CaptureRequest | null>(
  null,
);

export { captureRequest };

export const openCapture = (
  mode: CaptureMode = "fact",
  people: PersonRef[] = [],
) => setCaptureRequest({ mode, people });

export const closeCapture = () => setCaptureRequest(null);

/** A readable save error: the store's own message, or a generic one. */
export function saveErrorText(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (!message || message.length > 200 || message.startsWith("[")) {
    return fallback;
  }
  return message;
}
