import { Show } from "solid-js";
import { CaptureDialog } from "./CaptureDialog";
import { captureRequest, closeCapture } from "./capture-state";

/** Renders the capture dialog whenever something calls openCapture(). */
export function PeopleCaptureHost() {
  return (
    <Show when={captureRequest()} keyed>
      {(request) => <CaptureDialog request={request} onClose={closeCapture} />}
    </Show>
  );
}
