import { PlusIcon } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Kbd } from "~/components/ui/kbd";
import { formatDue, formatDuration } from "./taskFormat";
import { parseTaskInput, type ParsedTaskInput } from "./taskTitle";

type Props = {
  todayKey: string;
  disabled?: boolean;
  ref?: (element: HTMLInputElement) => void;
  onSubmit: (parsed: ParsedTaskInput) => Promise<void>;
};

const wrapClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  pl: "1",
  pr: "2",
  h: "9",
  borderRadius: "l2",
  bg: "gray.a2",
  color: "fg.subtle",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "fast",
  _hover: { bg: "gray.a3" },
  _focusWithin: {
    bg: "bg.default",
    boxShadow: "inset 0 0 0 1px token(colors.gray.a7)",
  },
});

const inputClass = css({
  flex: "1",
  minW: "0",
  h: "full",
  bg: "transparent",
  borderWidth: "0",
  outline: "none",
  fontSize: "sm",
  color: "fg.default",
  _placeholder: { color: "fg.subtle" },
});

const previewClass = css({
  display: "flex",
  gap: "2",
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

export const TaskQuickAdd = (props: Props) => {
  const [value, setValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const parsed = createMemo(() => parseTaskInput(value(), props.todayKey));
  const chips = createMemo(() => {
    const result = parsed();
    const items: string[] = [];
    if (result.dueDate) items.push(formatDue(result.dueDate, props.todayKey).label);
    if (result.durationMinutes) items.push(formatDuration(result.durationMinutes));
    for (const tag of result.tags) items.push(`#${tag}`);
    return items;
  });

  const submit = async () => {
    const result = parsed();
    if (!value().trim()) return;
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
      <span class={css({ display: "inline-flex", w: "6", justifyContent: "center" })}>
        <PlusIcon size={16} />
      </span>
      <input
        ref={(element) => props.ref?.(element)}
        class={inputClass}
        value={value()}
        disabled={props.disabled}
        aria-label="Add a task"
        placeholder="Add a task  #tag  @tomorrow  ~30m"
        data-testid="task-quick-add-input"
        onInput={(event) => {
          setValue(event.currentTarget.value);
          if (error()) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !saving()) {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setValue("");
            event.currentTarget.blur();
          }
        }}
      />
      <Show
        when={error()}
        fallback={
          <Show
            when={chips().length > 0}
            fallback={
              <Kbd size="sm" class={css({ display: { base: "none", md: "inline-flex" } })}>
                N
              </Kbd>
            }
          >
            <span class={previewClass} data-testid="task-quick-add-preview">
              <For each={chips()}>{(chip) => <span>{chip}</span>}</For>
              <span class={css({ color: "fg.subtle" })}>↵</span>
            </span>
          </Show>
        }
      >
        {(message) => <span class={css({ fontSize: "xs", color: "red.11" })}>{message()}</span>}
      </Show>
    </label>
  );
};
