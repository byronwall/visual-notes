import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PlanTask } from "~/lib/pathways/types";
import { fetchTaskLists } from "~/services/tasks/tasks.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
import { usePathway } from "./pathway-state";
import { help, label, smallButton } from "./styles";

const box = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "3",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
  bg: "bg.subtle",
});
const item = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "2",
  fontSize: "sm",
  cursor: "pointer",
});
const select = css({
  h: "7",
  px: "2",
  fontSize: "sm",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "md",
  bg: "bg.default",
  color: "fg.default",
});

/**
 * Pick which open Next steps become real tasks, and which list they go to.
 * Only this thin slice of a pathway becomes tasks; each stays linked.
 */
export function ExportPicker(props: { tasks: PlanTask[]; onDone: () => void }) {
  const s = usePathway();
  const candidates = () => props.tasks.filter((t) => !t.taskId);
  const [picked, setPicked] = createSignal(
    new Set(candidates().map((t) => t.id)),
  );
  // Fetched when the picker opens, so it never suspends the page.
  const lists = createKeptAsync(() => fetchTaskLists(), onDemand);
  const [listId, setListId] = createSignal<string | null>(
    s.record().exportListId,
  );
  const [busy, setBusy] = createSignal(false);
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    setBusy(true);
    const ok = await s.exportTasks([...picked()], listId());
    setBusy(false);
    if (ok) props.onDone();
  };

  return (
    <div class={box}>
      <span class={label}>Export to tasks</span>
      <Show
        when={candidates().length}
        fallback={<p class={help}>Every open step is already a task.</p>}
      >
        <For each={candidates()}>
          {(t) => (
            <label class={item}>
              <input
                type="checkbox"
                checked={picked().has(t.id)}
                onChange={() => toggle(t.id)}
              />
              <span>{t.title}</span>
            </label>
          )}
        </For>
        <div
          class={css({
            display: "flex",
            alignItems: "center",
            gap: "2",
            flexWrap: "wrap",
          })}
        >
          <span class={help}>To list</span>
          <select
            class={select}
            value={
              lists.latest?.find((l) => l.id === listId())?.name === "Inbox"
                ? ""
                : listId() ?? ""
            }
            onChange={(e) => setListId(e.currentTarget.value || null)}
          >
            <option value="">Inbox</option>
            <For each={(lists.latest ?? []).filter((l) => l.name !== "Inbox")}>
              {(l) => <option value={l.id}>{l.name}</option>}
            </For>
          </select>
          <span style={{ flex: "1" }} />
          <button class={smallButton} onClick={() => props.onDone()}>
            Cancel
          </button>
          <button
            class={smallButton}
            data-on="true"
            disabled={!picked().size || busy()}
            onClick={run}
          >
            {busy()
              ? "Exporting…"
              : `Export ${picked().size} ${picked().size === 1 ? "task" : "tasks"}`}
          </button>
        </div>
        <p class={help}>
          Each task links back to this map. Checking it off on the Tasks page
          checks it off here.
        </p>
      </Show>
    </div>
  );
}
