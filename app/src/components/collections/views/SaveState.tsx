import { CheckIcon, CircleAlertIcon, LoaderIcon } from "lucide-solid";
import { Match, Switch } from "solid-js";
import { css } from "styled-system/css";
import { useCollection } from "../CollectionContext";
import { toolbarBtn } from "./toolbar-styles";

// Same width as TOOLBAR_NARROW; Panda needs the literal in this file.
const NARROW = "@container coltoolbar (max-width: 35rem)";

const status = css({ display: "inline-flex", alignItems: "center" });
const quiet = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  px: "1.5",
  color: "fg.subtle",
  fontSize: "xs",
  whiteSpace: "nowrap",
  [NARROW]: { "& [data-label]": { display: "none" } },
});
const spin = css({
  animation: "spin",
  _motionReduce: { animation: "none" },
});
const errorBtn = css({
  color: "fg.error",
  fontSize: "xs",
  _hover: { color: "fg.error", bg: "red.a2" },
});

/**
 * Save state of the view's filter, sort, columns and widths. Quiet while
 * idle; a failed save keeps the local view and offers Retry.
 */
export const SaveState = (props: { viewId: string }) => {
  const { store } = useCollection();
  const state = () => store.viewSaveState(props.viewId);
  return (
    <span class={status} role="status" aria-live="polite">
      <Switch>
        <Match when={state() === "saving"}>
          <span class={quiet} title="Saving view changes">
            <LoaderIcon size={13} class={spin} aria-hidden="true" />
            <span data-label>Saving…</span>
          </span>
        </Match>
        <Match when={state() === "saved"}>
          <span class={quiet} title="View changes saved">
            <CheckIcon size={13} aria-hidden="true" />
            <span data-label>Saved</span>
          </span>
        </Match>
        <Match when={state() === "error"}>
          <button
            type="button"
            class={`${toolbarBtn} ${errorBtn}`}
            title="Couldn't save view changes. They stay on this page until saved."
            aria-label="Couldn't save view. Retry"
            onClick={() => store.retryViewSave(props.viewId)}
          >
            <CircleAlertIcon size={13} aria-hidden="true" />
            <span data-label>Couldn't save view ·</span> Retry
          </button>
        </Match>
      </Switch>
    </span>
  );
};
