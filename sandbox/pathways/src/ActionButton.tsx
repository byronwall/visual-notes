import { Show } from "solid-js";

/** An agent action: a short name plus one line on what it will do to the map. */
export function ActionButton(props: {
  label: string;
  what: string;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button class="action" classList={{ primary: props.primary }} disabled={props.disabled} onClick={() => props.onClick()}>
      <span class="action-label">
        {props.busy ? "Thinking…" : props.label}
        <Show when={props.shortcut}>
          <kbd>{props.shortcut}</kbd>
        </Show>
      </span>
      <span class="action-what">{props.what}</span>
    </button>
  );
}
