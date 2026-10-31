import { onMount } from "solid-js";
import { css } from "styled-system/css";

type Props = {
  initialValue: string;
  ariaLabel: string;
  placeholder?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
};

const inputClass = css({
  h: "8",
  w: "full",
  minW: "8rem",
  px: "2.5",
  borderRadius: "l2",
  borderWidth: "0",
  bg: "bg.default",
  boxShadow: "inset 0 0 0 1px token(colors.gray.a7)",
  // iOS Safari zooms the page when it focuses text smaller than 16px.
  fontSize: { base: "md", md: "sm" },
  color: "fg.default",
  outline: "none",
  _placeholder: { color: "fg.subtle" },
});

/** Inline edit-in-place field for creating or renaming a list. */
export const TaskListNameInput = (props: Props) => {
  let inputRef: HTMLInputElement | undefined;
  let settled = false;

  const commit = () => {
    if (settled) return;
    settled = true;
    props.onCommit(inputRef?.value.trim() ?? "");
  };

  onMount(() =>
    queueMicrotask(() => {
      inputRef?.focus();
      inputRef?.select();
    })
  );

  return (
    <input
      ref={inputRef}
      class={inputClass}
      value={props.initialValue}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      data-testid="task-list-name-input"
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          settled = true;
          props.onCancel();
        }
      }}
    />
  );
};
