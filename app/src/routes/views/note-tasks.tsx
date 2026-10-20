import { A } from "@solidjs/router";
import { Show, createResource } from "solid-js";
import { css } from "styled-system/css";
import { NoteGroupList, rowLinkClass } from "~/components/views/NoteGroupList";
import { ViewPageShell } from "~/components/views/ViewPageShell";
import { fetchOpenNoteTasks } from "~/services/note-views.queries";

const boxClass = css({
  mt: "0.2em",
  w: "3.5",
  h: "3.5",
  flexShrink: "0",
  borderWidth: "1.5px",
  borderColor: "gray.a8",
  borderRadius: "l1",
});

export default function OpenNoteTasksRoute() {
  const [groups] = createResource(() => fetchOpenNoteTasks());
  const count = () =>
    (groups.latest ?? []).reduce((sum, g) => sum + g.items.length, 0);
  return (
    <ViewPageShell
      title="Open tasks in notes"
      subtitle={
        <>
          {count()} open {count() === 1 ? "task" : "tasks"} written inline in notes · they also
          live in your <A href="/tasks">Inbox list</A>
        </>
      }
    >
      <NoteGroupList
        groups={groups.latest ?? []}
        empty="No open tasks in notes. Type [] at the start of a line in a note to add one."
        renderItem={(task) => (
          <A
            href={`/docs/${task.docId}${task.blockId ? `#b-${task.blockId}` : ""}`}
            class={rowLinkClass}
          >
            <span class={boxClass} aria-hidden="true" />
            <span class={css({ flex: "1", minW: "0" })}>{task.description}</span>
            <Show when={task.dueDate}>
              <span class={css({ fontSize: "xs", color: "fg.muted", flexShrink: "0" })}>
                {task.dueDate}
              </span>
            </Show>
          </A>
        )}
      />
    </ViewPageShell>
  );
}
