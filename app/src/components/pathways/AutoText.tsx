import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { css, cx } from "styled-system/css";

const field = css({
  display: "block",
  w: "full",
  minH: "8",
  px: "2.5",
  py: "1.5",
  fontSize: "sm",
  lineHeight: "1.45",
  color: "fg.default",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  resize: "none",
  overflow: "hidden",
  transition: "border-color 140ms",
  _placeholder: { color: "fg.subtle" },
  _focus: { outline: "none", borderColor: "border.focus" },
});

/**
 * The one text field in the sandbox: a textarea that grows with its content
 * and saves as you type. It saves 500ms after typing stops, on blur, when
 * `key` changes (another node selected), and when it unmounts, so text is
 * never lost. Esc reverts to the saved value. ⌘/Ctrl+Enter submits. With
 * `singleLine`, Enter saves and newlines become spaces.
 */
export function AutoText(props: {
  value: string;
  /** Gets the key the text was typed under, which may no longer be the current one. */
  onSave: (value: string, key: string | undefined) => void;
  /** Identity of what is being edited. A change saves the old draft first. */
  key?: string;
  placeholder?: string;
  class?: string;
  minRows?: number;
  /** Grows up to this height in px, then scrolls. */
  maxHeight?: number;
  singleLine?: boolean;
  /** Save delay after typing stops, in ms. 0 saves on every keystroke (for cheap local state). */
  delay?: number;
  onSubmit?: (value: string) => void;
  autofocus?: boolean;
  /** Each change focuses the field and selects its text. */
  focusTick?: number;
  ref?: (el: HTMLTextAreaElement) => void;
}) {
  let el!: HTMLTextAreaElement;
  const [draft, setDraft] = createSignal(props.value);
  let pending: {
    save: (v: string, key: string | undefined) => void;
    value: string;
    key: string | undefined;
  } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    if (pending) {
      const p = pending;
      pending = null;
      p.save(p.value, p.key);
    }
  };

  const resize = () => {
    if (!el) return;
    el.style.height = "auto";
    const max = props.maxHeight ?? 480;
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
  };

  // Another record: save the old draft, then show the new value.
  createEffect(
    on(
      () => props.key,
      () => {
        flush();
        setDraft(props.value);
        queueMicrotask(resize);
      },
      { defer: true },
    ),
  );
  // The saved value changed elsewhere (agent, undo, another tab) and we hold no edits.
  createEffect(
    on(
      () => props.value,
      (v) => {
        if (!pending && document.activeElement !== el) {
          setDraft(v);
          queueMicrotask(resize);
        }
      },
      { defer: true },
    ),
  );
  // After the key effect has swapped in the new value, so select() takes the new text.
  createEffect(
    on(
      () => props.focusTick,
      (t) => t && queueMicrotask(() => (el.focus(), el.select())),
      { defer: true },
    ),
  );

  onMount(() => {
    // A server-rendered textarea arrives empty (Solid renders its value as an
    // attribute), and hydration does not set it, so set it once here.
    if (el.value !== draft()) el.value = draft();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    if (props.autofocus) el.focus();
    onCleanup(() => ro.disconnect());
  });
  onCleanup(flush);

  const clean = (v: string) =>
    props.singleLine ? v.replace(/\s*\n\s*/g, " ") : v;

  return (
    <textarea
      ref={(e) => {
        el = e;
        props.ref?.(e);
      }}
      class={cx(field, props.class)}
      rows={props.minRows ?? 1}
      placeholder={props.placeholder}
      value={draft()}
      onInput={(e) => {
        const v = clean(e.currentTarget.value);
        if (v !== e.currentTarget.value) e.currentTarget.value = v;
        setDraft(v);
        resize();
        if (v === props.value) {
          pending = null;
          clearTimeout(timer);
          return;
        }
        pending = { save: props.onSave, value: v, key: props.key };
        clearTimeout(timer);
        if (props.delay === 0) flush();
        else timer = setTimeout(flush, props.delay ?? 500);
      }}
      onBlur={flush}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          pending = null;
          clearTimeout(timer);
          setDraft(props.value);
          queueMicrotask(resize);
          el.blur();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          flush();
          props.onSubmit?.(draft());
        } else if (e.key === "Enter" && props.singleLine && !e.shiftKey) {
          e.preventDefault();
          flush();
          if (props.onSubmit) props.onSubmit(draft());
          else el.blur();
        }
      }}
    />
  );
}
