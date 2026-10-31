import { ArrowLeftIcon } from "lucide-solid";
import { For } from "solid-js";
import { css } from "styled-system/css";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { useTaskTree } from "./TaskTreeContext";

export const sheetRowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  w: "full",
  minH: "11",
  px: "2",
  borderRadius: "l2",
  fontSize: "md",
  color: "fg.default",
  textAlign: "left",
  cursor: "pointer",
  _active: { bg: "gray.a4" },
});

export const TaskSheetLists = (props: {
  task: TaskItem;
  onBack: () => void;
}) => {
  const ctx = useTaskTree();
  return (
    <div class={css({ mt: "1", maxH: "60dvh", overflowY: "auto" })}>
      <button type="button" class={sheetRowClass} onClick={() => props.onBack()}>
        <ArrowLeftIcon size={16} />
        Move to list
      </button>
      <For each={ctx.otherLists()}>
        {(list) => (
          <button
            type="button"
            class={sheetRowClass}
            onClick={() => {
              ctx.closeSheet();
              ctx.moveToList(props.task, list.id);
            }}
          >
            {list.name}
          </button>
        )}
      </For>
    </div>
  );
};
