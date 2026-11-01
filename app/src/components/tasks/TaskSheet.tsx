import { XIcon } from "lucide-solid";
import { createEffect, createSignal, Match, Show, Switch } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { A } from "@solidjs/router";
import * as Drawer from "~/components/ui/drawer";
import { IconButton } from "~/components/ui/icon-button";
import { Textarea } from "~/components/ui/textarea";
import type { TaskItem } from "~/services/tasks/tasks.service";
import { TaskSheetLists } from "./TaskSheetLists";
import { TaskSheetMain } from "./TaskSheetMain";
import { TaskSheetSubtask } from "./TaskSheetSubtask";
import { useTaskTree } from "./TaskTreeContext";

const contentClass = css({
  maxH: "92dvh",
  overflowY: "auto",
  borderTopRadius: "l3",
  p: "3",
  pb: "calc(token(spacing.3) + env(safe-area-inset-bottom))",
  outline: "none",
});

const titleClass = css({
  flex: "1",
  minW: "0",
  maxH: "6.5rem",
  minH: "11",
  fontSize: "md",
  fontWeight: "medium",
  lineHeight: "1.375rem",
  resize: "none",
});

const SheetBody = (props: { task: TaskItem }) => {
  const ctx = useTaskTree();
  const [view, setView] = createSignal<"main" | "subtask" | "lists">("main");
  const [title, setTitle] = createSignal("");

  createEffect(() => setTitle(props.task.description));

  const saveTitle = () => {
    const next = title().trim();
    if (next && next !== props.task.description)
      ctx.updateFields(props.task, { description: next });
  };

  return (
    <div data-testid="task-sheet">
      <div class={css({ display: "flex", alignItems: "flex-start", gap: "1" })}>
        <Textarea
          class={titleClass}
          value={title()}
          rows={1}
          autoresize
          aria-label="Task title"
          data-testid="task-sheet-title"
          onInput={(event) => setTitle(event.currentTarget.value)}
          onBlur={saveTitle}
        />
        <Drawer.CloseTrigger
          asChild={(closeProps) => (
            <IconButton
              {...closeProps}
              variant="plain"
              size="lg"
              aria-label="Close"
            >
              <XIcon size={18} />
            </IconButton>
          )}
        />
      </div>

      <Show when={props.task.source}>
        {(source) => (
          <A
            href={`/docs/${source().docId}${source().blockId ? `#b-${source().blockId}` : ""}`}
            class={css({
              display: "block",
              py: "1.5",
              fontSize: "sm",
              color: "fg.link",
              textDecorationLine: "none",
            })}
          >
            ↗ {source().title}
          </A>
        )}
      </Show>

      <Switch>
        <Match when={view() === "lists"}>
          <TaskSheetLists task={props.task} onBack={() => setView("main")} />
        </Match>
        <Match when={view() === "subtask"}>
          <TaskSheetSubtask task={props.task} onBack={() => setView("main")} />
        </Match>
        <Match when={view() === "main"}>
          <TaskSheetMain
            task={props.task}
            onShowSubtask={() => setView("subtask")}
            onShowLists={() => setView("lists")}
          />
        </Match>
      </Switch>
    </div>
  );
};

/** Everything a phone can do to a task, within thumb reach and without a keyboard. */
export const TaskSheet = () => {
  const ctx = useTaskTree();
  let contentRef: HTMLDivElement | undefined;

  return (
    <Drawer.Root
      placement="bottom"
      open={ctx.sheetOpen()}
      onOpenChange={(details) => {
        if (!details.open) ctx.closeSheet();
      }}
      restoreFocus={false}
      // Focusing the title would raise the keyboard over the buttons.
      initialFocusEl={() => contentRef ?? null}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            ref={(element: HTMLDivElement) => (contentRef = element)}
            class={contentClass}
            tabIndex={-1}
          >
            <Drawer.Title srOnly>Task actions</Drawer.Title>
            <Show when={ctx.sheetTask()}>
              {(task) => <SheetBody task={task()} />}
            </Show>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
};
