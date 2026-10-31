import { ChevronDownIcon } from "lucide-solid";
import { createMemo, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import * as Popover from "~/components/ui/popover";
import type { TaskListItem } from "~/services/tasks/tasks.service";
import { getDisplayName, TaskListPanel } from "./TaskListPanel";

type Props = {
  lists: TaskListItem[];
  selectedListId: string | null;
  /** Open-task count for the selected list, which is known client-side. */
  selectedOpenCount: number | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (list: TaskListItem, nextName: string) => void;
  onDelete: (list: TaskListItem) => Promise<void>;
};

const triggerClass = css({
  justifyContent: "flex-start",
  gap: "2",
  w: "full",
  h: "11",
  px: "1",
  fontSize: "lg",
  fontWeight: "semibold",
  color: "fg.default",
});

const triggerNameClass = css({
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const triggerCountClass = css({
  flexShrink: 0,
  fontSize: "sm",
  fontWeight: "normal",
  color: "fg.muted",
  fontVariantNumeric: "tabular-nums",
});

export const TaskListSelector = (props: Props) => {
  const [pendingDelete, setPendingDelete] = createSignal<TaskListItem | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = createSignal(false);

  const selectedList = createMemo(() =>
    props.lists.find((list) => list.id === props.selectedListId),
  );
  const selectedCount = () =>
    props.selectedOpenCount ?? selectedList()?.taskCount ?? 0;

  const panel = (touch: boolean) => (
    <TaskListPanel
      lists={props.lists}
      selectedListId={props.selectedListId}
      selectedOpenCount={props.selectedOpenCount}
      touch={touch}
      onSelect={(id) => {
        setSheetOpen(false);
        props.onSelect(id);
      }}
      onCreate={(name) => {
        setSheetOpen(false);
        void props.onCreate(name);
      }}
      onRename={props.onRename}
      onDelete={(list) => {
        setSheetOpen(false);
        setPendingDelete(list);
      }}
    />
  );

  return (
    <nav
      aria-label="Task lists"
      data-testid="task-lists-nav"
      class={css({ display: "flex", flexDirection: "column", minH: "0" })}
    >
      <div
        class={css({
          display: { base: "none", lg: "flex" },
          flexDirection: "column",
          minH: "0",
        })}
      >
        {panel(false)}
      </div>

      <div class={css({ display: { base: "block", lg: "none" } })}>
        <Popover.Root
          open={sheetOpen()}
          onOpenChange={(details) => setSheetOpen(details.open)}
          positioning={{
            placement: "bottom-start",
            strategy: "fixed",
            sameWidth: true,
            gutter: 4,
          }}
        >
          <Popover.Trigger
            asChild={(triggerProps) => (
              <Button
                {...triggerProps}
                class={triggerClass}
                variant="plain"
                data-testid="task-list-switcher"
              >
                <span class={triggerNameClass}>
                  {selectedList()
                    ? getDisplayName(selectedList()!)
                    : "Task lists"}
                </span>
                <span
                  class={triggerCountClass}
                  data-testid="task-list-switcher-count"
                >
                  {selectedCount() > 0 ? selectedCount() : ""}
                </span>
                <ChevronDownIcon size={16} />
              </Button>
            )}
          />
          <Portal>
            <Popover.Positioner zIndex="popover">
              <Popover.Content
                zIndex="popover"
                w="full"
                maxW="full"
                maxH="calc(100dvh - 7.5rem)"
                p="1"
                display="flex"
                flexDirection="column"
                overflow="hidden"
                aria-label="Task lists"
                data-testid="task-list-sheet"
              >
                {panel(true)}
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </div>

      <ConfirmDialog
        open={!!pendingDelete()}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete task list?"
        description={
          pendingDelete()
            ? `Delete "${getDisplayName(pendingDelete()!)}" and all of its tasks? This cannot be undone.`
            : "Delete this task list? This cannot be undone."
        }
        confirmLabel="Delete list"
        onConfirm={() => {
          const list = pendingDelete();
          if (!list) return;
          void props.onDelete(list);
          setPendingDelete(null);
        }}
      />
    </nav>
  );
};
