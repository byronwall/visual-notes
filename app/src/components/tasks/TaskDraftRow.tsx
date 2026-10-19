import { CircleDashedIcon } from "lucide-solid";
import { onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { rowClass } from "./TaskRow";

type Props = {
  value: string;
  saving: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const inputClass = css({
  appearance: "none",
  bg: "transparent",
  borderWidth: "0",
  color: "fg.default",
  flex: "1",
  minW: "0",
  py: "0.5",
  fontSize: "sm",
  lineHeight: "1.25rem",
  outline: "none",
  _placeholder: { color: "fg.subtle" },
});

const slotClass = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "6",
  h: "6",
  color: "fg.subtle",
});

export const TaskDraftRow = (props: Props) => {
  let inputRef: HTMLInputElement | undefined;

  onMount(() => queueMicrotask(() => inputRef?.focus()));

  return (
    <div class={rowClass} data-selected="true" data-testid="task-inline-create-row">
      <span class={slotClass} />
      <span class={slotClass}>
        <CircleDashedIcon size={16} />
      </span>
      <input
        ref={inputRef}
        class={inputClass}
        value={props.value}
        disabled={props.saving}
        aria-label="New task title"
        placeholder="New task  #tag  @fri  ~30m"
        onInput={(event) => props.onChange(event.currentTarget.value)}
        onBlur={() => {
          if (!props.value.trim() && !props.saving) props.onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            props.onSubmit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
          }
        }}
      />
      <Show when={props.error}>
        {(error) => (
          <span class={css({ fontSize: "xs", color: "red.11", py: "0.5", lineHeight: "1.25rem" })}>
            {error()}
          </span>
        )}
      </Show>
    </div>
  );
};
