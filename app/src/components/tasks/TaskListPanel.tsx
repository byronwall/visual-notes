import { A } from "@solidjs/router";
import { PlusIcon } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { IconButton } from "~/components/ui/icon-button";
import type { TaskListItem } from "~/services/tasks/tasks.service";
import { TaskListNameInput } from "./TaskListNameInput";
import { TaskListRowMenu } from "./TaskListRowMenu";

type Props = {
  lists: TaskListItem[];
  selectedListId: string | null;
  selectedOpenCount: number | null;
  /** Touch layout for the phone popover: tall rows and an always-visible menu. */
  touch?: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (list: TaskListItem, nextName: string) => void;
  onDelete: (list: TaskListItem) => void;
};

export const getDisplayName = (list: TaskListItem) =>
  list.name.trim() || "Untitled list";

const noteTasksLinkClass = css({
  display: "block",
  px: "2.5",
  py: "1",
  fontSize: "xs",
  color: "fg.link",
  textDecorationLine: "none",
  borderRadius: "l2",
  _hover: { bg: "bg.hover" },
  "&[data-touch=true]": { py: "2.5", fontSize: "sm" },
});

const itemsClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  overflowY: "auto",
  minH: "0",
});

const itemClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "2",
  minH: "8",
  // In the scrolling column, shrinking would clip wrapped names into the next row.
  flexShrink: 0,
  maxW: "full",
  pl: "2.5",
  pr: "1",
  py: "1",
  borderRadius: "l2",
  fontSize: "sm",
  lineHeight: "1.5rem",
  color: "fg.muted",
  cursor: "pointer",
  userSelect: "none",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-selected=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
  "& [data-reveal]": {
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: "fast",
  },
  "&:hover [data-reveal], & [data-reveal][data-state=open], & [data-reveal]:focus-visible":
    {
      opacity: 1,
    },
  "@media (hover: none)": { "& [data-reveal]": { display: "none" } },
  "&[data-touch=true]": {
    alignItems: "center",
    minH: "11",
    py: "0",
    pr: "0",
    fontSize: "md",
  },
  "&[data-touch=true] [data-reveal]": {
    display: "inline-flex",
    opacity: 1,
    w: "11",
    h: "11",
  },
});

const countClass = css({
  ml: "auto",
  minW: "5",
  textAlign: "right",
  fontSize: "xs",
  fontWeight: "normal",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
});

/** The full list of task lists: the desktop column and the phone popover body. */
export const TaskListPanel = (props: Props) => {
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const touch = () => (props.touch ? "true" : "false");

  return (
    <div
      class={css({
        display: "flex",
        flexDirection: "column",
        gap: "1",
        minH: "0",
      })}
    >
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          h: "8",
          pl: "2.5",
        })}
      >
        <span
          class={css({
            fontSize: "xs",
            fontWeight: "medium",
            color: "fg.subtle",
            textTransform: "uppercase",
            letterSpacing: "wider",
          })}
        >
          Lists
        </span>
        <IconButton
          size={props.touch ? "lg" : "2xs"}
          variant="plain"
          ml="auto"
          aria-label="New list"
          data-testid="task-list-create-button"
          onClick={() => setCreating(true)}
        >
          <PlusIcon size={14} />
        </IconButton>
      </div>

      <A
        href="/views/note-tasks"
        class={noteTasksLinkClass}
        data-touch={touch()}
      >
        Open tasks in notes →
      </A>

      <div class={itemsClass}>
        <For each={props.lists}>
          {(list) => {
            const selected = () => props.selectedListId === list.id;
            return (
              <Show
                when={renamingId() === list.id}
                fallback={
                  <div
                    class={itemClass}
                    role="button"
                    tabIndex={0}
                    aria-current={selected() ? "page" : undefined}
                    data-selected={selected() ? "true" : "false"}
                    data-touch={touch()}
                    data-testid={`task-list-item-${list.id}`}
                    onClick={() => props.onSelect(list.id)}
                    onDblClick={() => setRenamingId(list.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        props.onSelect(list.id);
                      } else if (event.key === "F2") {
                        event.preventDefault();
                        setRenamingId(list.id);
                      }
                    }}
                  >
                    <span class={css({ minW: "0", overflowWrap: "anywhere" })}>
                      {getDisplayName(list)}
                    </span>
                    <span
                      class={countClass}
                      data-testid={`task-list-count-${list.id}`}
                    >
                      {(() => {
                        const count =
                          selected() && props.selectedOpenCount !== null
                            ? props.selectedOpenCount
                            : list.taskCount;
                        return count > 0 ? count : "";
                      })()}
                    </span>
                    <span
                      class={css({ display: "inline-flex" })}
                      onClick={(event) => event.stopPropagation()}
                      onDblClick={(event) => event.stopPropagation()}
                    >
                      <TaskListRowMenu
                        listName={getDisplayName(list)}
                        onRename={() => setRenamingId(list.id)}
                        onDelete={() => props.onDelete(list)}
                      />
                    </span>
                  </div>
                }
              >
                <TaskListNameInput
                  initialValue={list.name}
                  ariaLabel={`Rename ${getDisplayName(list)}`}
                  onCommit={(name) => {
                    setRenamingId(null);
                    if (name && name !== list.name) props.onRename(list, name);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              </Show>
            );
          }}
        </For>

        <Show when={creating()}>
          <TaskListNameInput
            initialValue=""
            placeholder="List name"
            ariaLabel="New list name"
            onCommit={(name) => {
              setCreating(false);
              if (name) props.onCreate(name);
            }}
            onCancel={() => setCreating(false)}
          />
        </Show>
      </div>
    </div>
  );
};
