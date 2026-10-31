import { ArrowLeftIcon } from "lucide-solid";
import { createSignal, For, onMount } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { sheetRowClass } from "./TaskSheetLists";
import { useTaskTree } from "./TaskTreeContext";

const inputClass = css({
  flex: "1",
  minW: "0",
  h: "11",
  px: "2",
  borderRadius: "l2",
  bg: "gray.a2",
  outline: "none",
  fontSize: "md",
  color: "fg.default",
});

/** Adds subtasks in place, so the keyboard stays up for the next one. */
export const TaskSheetSubtask = (props: {
  task: TaskItem;
  onBack: () => void;
}) => {
  const ctx = useTaskTree();
  const [value, setValue] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  onMount(() => inputRef?.focus());

  const submit = () => {
    const text = value().trim();
    if (!text) return;
    setValue("");
    ctx.addSubtaskNow(props.task, text);
  };

  return (
    <div class={css({ mt: "1" })}>
      <button type="button" class={sheetRowClass} onClick={() => props.onBack()}>
        <ArrowLeftIcon size={16} />
        Subtasks
      </button>
      <For each={ctx.childIds(props.task.id)}>
        {(id) => (
          <div
            class={css({ py: "1", pl: "2", fontSize: "sm", color: "fg.muted" })}
          >
            {ctx.task(id)?.description}
          </div>
        )}
      </For>
      <div class={css({ display: "flex", gap: "1", mt: "1" })}>
        <input
          ref={inputRef}
          class={inputClass}
          value={value()}
          placeholder="New subtask  #tag  @fri  ~30m"
          aria-label="New subtask"
          data-testid="task-sheet-subtask-input"
          onInput={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          h="11"
          disabled={!value().trim()}
          data-testid="task-sheet-subtask-add"
          onMouseDown={(event) => event.preventDefault()}
          onClick={submit}
        >
          Add
        </Button>
      </div>
    </div>
  );
};
