import { Show, createUniqueId } from "solid-js";
import { css } from "styled-system/css";
import { noAutofill } from "~/components/ui/no-autofill";
import { FieldError } from "./FieldError";

export type EditEnd = "commit" | "cancel" | "tab" | "shift-tab" | "blur";

// One line, laid over the value so the cell keeps its size while typing.
const overlay = css({
  position: "absolute",
  inset: "0",
  w: "full",
  px: "2",
  fontSize: "sm",
  bg: "bg.default",
  outline: "none",
  boxShadow: "inset 0 0 0 2px token(colors.border.accent)",
  borderRadius: "l1",
  "&[aria-invalid=true]": {
    boxShadow: "inset 0 0 0 2px token(colors.red.a8)",
  },
});
// Several lines, in the flow so the field grows with the text. Padding and
// line height match the read-only text, so nothing moves when editing starts.
const area = css({
  display: "block",
  w: "full",
  py: "1.5",
  fontSize: "sm",
  lineHeight: "1.25rem",
  bg: "transparent",
  outline: "none",
  border: "none",
  resize: "none",
  overflow: "hidden",
  overflowWrap: "anywhere",
});

const grow = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/**
 * The text editor inside a value. One line commits on Enter. Several lines
 * take Enter as a newline and commit on Cmd/Ctrl+Enter. Both commit on blur,
 * cancel on Escape, and move on with Tab.
 */
export const InlineEditor = (props: {
  value: string;
  multiline?: boolean;
  label: string;
  placeholder?: string;
  inputMode?: "decimal" | "email";
  error?: string | null;
  /** The element the error sits under. */
  anchor?: HTMLElement;
  onInput: (value: string) => void;
  onEnd: (reason: EditEnd) => void;
}) => {
  const errorId = createUniqueId();

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.isComposing) return;
    const commit =
      e.key === "Enter" && (!props.multiline || e.metaKey || e.ctrlKey);
    if (commit) {
      e.preventDefault();
      props.onEnd("commit");
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onEnd("cancel");
    } else if (e.key === "Tab") {
      e.preventDefault();
      props.onEnd(e.shiftKey ? "shift-tab" : "tab");
    }
  };

  const focusEnd = (el: HTMLInputElement | HTMLTextAreaElement) =>
    queueMicrotask(() => {
      if (el instanceof HTMLTextAreaElement) grow(el);
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });

  const shared = () => ({
    ...noAutofill,
    value: props.value,
    placeholder: props.placeholder,
    "aria-label": `Edit ${props.label}`,
    "aria-invalid": props.error ? ("true" as const) : undefined,
    "aria-describedby": props.error ? errorId : undefined,
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onBlur: () => props.onEnd("blur"),
    onKeyDown,
  });

  return (
    <>
      <Show
        when={props.multiline}
        fallback={
          <input
            {...shared()}
            class={overlay}
            inputMode={props.inputMode}
            ref={focusEnd}
            onInput={(e) => props.onInput(e.currentTarget.value)}
          />
        }
      >
        <textarea
          {...shared()}
          class={area}
          rows={1}
          ref={focusEnd}
          onInput={(e) => {
            grow(e.currentTarget);
            props.onInput(e.currentTarget.value);
          }}
        />
      </Show>
      <Show when={props.error && props.anchor}>
        <FieldError
          id={errorId}
          message={props.error!}
          anchor={props.anchor!}
        />
      </Show>
    </>
  );
};
