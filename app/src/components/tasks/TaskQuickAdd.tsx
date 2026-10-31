import { PlusIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { TaskQuickTokens } from "./TaskQuickTokens";
import { formatDue, formatDuration } from "./taskFormat";
import { parseTaskInput, type ParsedTaskInput } from "./taskTitle";

type Props = {
  todayKey: string;
  /** The list's most used tags, offered as one-tap tokens on phones. */
  tags: string[];
  disabled?: boolean;
  ref?: (element: HTMLTextAreaElement) => void;
  onSubmit: (parsed: ParsedTaskInput) => Promise<void>;
};

const wrapClass = css({
  display: "flex",
  flexWrap: { base: "wrap", md: "nowrap" },
  alignItems: "flex-start",
  columnGap: "1",
  pl: { base: "0", md: "1" },
  pr: { base: "0", md: "2" },
  minH: { base: "11", md: "9" },
  flexShrink: 0,
  borderRadius: "l2",
  bg: "gray.a2",
  color: "fg.subtle",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
  _focusWithin: {
    bg: "bg.default",
    boxShadow: "inset 0 0 0 1px token(colors.gray.a7)",
    "& [data-hint]": { visibility: "hidden" },
    "@media (max-width: 47.99em)": { "& [data-tokens]": { display: "flex" } },
  },
});

const inputClass = css({
  display: "block",
  flex: "1",
  minW: "0",
  // Four lines on a phone, which leaves Add, the preview, and the tokens above
  // the keyboard.
  maxH: { base: "7.25rem", md: "8.75rem" },
  py: { base: "2.5", md: "2" },
  bg: "transparent",
  borderWidth: "0",
  outline: "none",
  resize: "none",
  overflowY: "auto",
  // iOS Safari zooms the page when it focuses text smaller than 16px.
  fontSize: { base: "md", md: "sm" },
  lineHeight: { base: "1.5rem", md: "1.25rem" },
  color: "fg.default",
  _placeholder: { color: "fg.subtle" },
});

const addClass = css({
  display: "none",
  flexShrink: 0,
  h: "11",
  minW: "11",
  px: "3",
  md: { order: 1 },
  "@media (pointer: coarse), (max-width: 47.99em)": { display: "inline-flex" },
});

const noteClass = css({
  display: "flex",
  flexWrap: { base: "wrap", md: "nowrap" },
  alignItems: "center",
  columnGap: "2",
  w: { base: "full", md: "auto" },
  minH: { md: "9" },
  pl: { base: "10", md: "0" },
  pb: { base: "1.5", md: "0" },
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

const isTouchKeyboard = () => window.matchMedia("(pointer: coarse)").matches;

export const TaskQuickAdd = (props: Props) => {
  const [value, setValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let inputRef: HTMLTextAreaElement | undefined;

  const parsed = createMemo(() => parseTaskInput(value(), props.todayKey));
  const chips = createMemo(() => {
    const result = parsed();
    const items: string[] = [];
    if (result.dueDate)
      items.push(formatDue(result.dueDate, props.todayKey).label);
    if (result.durationMinutes)
      items.push(formatDuration(result.durationMinutes));
    for (const tag of result.tags) items.push(`#${tag}`);
    return items;
  });

  createEffect(() => {
    const text = value();
    if (!inputRef) return;
    inputRef.style.height = "auto";
    if (text) inputRef.style.height = `${inputRef.scrollHeight}px`;
  });

  const insertToken = (token: string) => {
    const text = value().trimEnd();
    setValue(text ? `${text} ${token} ` : `${token} `);
    if (error()) setError(null);
  };

  const submit = async () => {
    const result = parsed();
    if (saving() || !value().trim()) return;
    if (!result.description) {
      setError("Add a title");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit(result);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <label class={wrapClass} data-testid="task-quick-add">
      {/* Reserve the chevron column so + and text align with row status and titles. */}
      <span
        class={css({
          display: { base: "none", md: "block" },
          w: "6",
          flexShrink: 0,
        })}
      />
      <span
        class={css({
          display: "inline-flex",
          alignItems: "center",
          w: { base: "9", md: "6" },
          h: { base: "11", md: "9" },
          flexShrink: 0,
          justifyContent: "center",
        })}
      >
        <PlusIcon size={16} />
      </span>
      <textarea
        ref={(element) => {
          inputRef = element;
          props.ref?.(element);
        }}
        class={inputClass}
        rows={1}
        value={value()}
        disabled={props.disabled}
        aria-label="Add a task"
        placeholder="Add a task  #tag  @fri  ~30m"
        data-testid="task-quick-add-input"
        onInput={(event) => {
          setValue(event.currentTarget.value);
          if (error()) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // A touch keyboard has no Shift key, so Enter adds a line there.
            if (event.shiftKey || isTouchKeyboard()) return;
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setValue("");
            event.currentTarget.blur();
          }
        }}
      />
      <Button
        class={addClass}
        size="sm"
        disabled={saving() || !value().trim()}
        data-testid="task-quick-add-submit"
        // Keep focus in the field so the keyboard stays up for the next task.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => void submit()}
      >
        Add
      </Button>
      <Show
        when={error()}
        fallback={
          <Show
            when={chips().length > 0}
            fallback={
              <Kbd
                size="sm"
                data-hint
                class={css({
                  display: { base: "none", md: "inline-flex" },
                  mt: "2",
                })}
              >
                N
              </Kbd>
            }
          >
            <span class={noteClass} data-testid="task-quick-add-preview">
              <For each={chips()}>{(chip) => <span>{chip}</span>}</For>
              <span
                class={css({
                  color: "fg.subtle",
                  "@media (pointer: coarse)": { display: "none" },
                })}
              >
                ↵
              </span>
            </span>
          </Show>
        }
      >
        {(message) => (
          <span class={noteClass}>
            <span class={css({ color: "red.11" })}>{message()}</span>
          </span>
        )}
      </Show>
      <TaskQuickTokens tags={props.tags} onInsert={insertToken} />
    </label>
  );
};
