import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PlanTask } from "~/lib/pathways/types";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { ExportPicker } from "./ExportPicker";
import { usePathway } from "./pathway-state";
import { cardLink, label, smallButton, textButton } from "./styles";

const col = css({
  p: "3",
  pb: "10",
  display: "flex",
  flexDirection: "column",
  gap: "2.5",
});
const lede = css({ m: "0", fontSize: "sm", lineHeight: "1.45" });
const actions = css({ display: "flex", flexDirection: "column" });
const listHead = css({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "2",
  mt: "1",
});
const list = css({
  listStyle: "none",
  m: "0",
  p: "0",
  borderTopWidth: "1px",
  borderColor: "border",
});
const task = css({
  display: "grid",
  gridTemplateColumns: "24px 1fr",
  gap: "2.5",
  alignItems: "start",
  py: "2.5",
  borderBottomWidth: "1px",
  borderColor: "border",
  transition: "background-color 200ms",
  "&[data-done=true]": { bg: "green.2" },
});
const check = css({
  w: "6",
  h: "6",
  fontSize: "xs",
  borderRadius: "full",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.default",
  color: "fg.muted",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background-color 160ms, border-color 160ms",
  _hover: { borderColor: "green.9", color: "green.11" },
  "[data-done=true] &": {
    bg: "green.9",
    borderColor: "green.9",
    color: "white",
  },
});
const titleText = css({
  fontSize: "sm",
  lineHeight: "1.35",
  fontWeight: "semibold",
  "[data-done=true] &, [data-skipped=true] &": { color: "fg.muted" },
  "[data-skipped=true] &": { textDecoration: "line-through" },
});
const meta = css({ fontSize: "xs", color: "fg.muted" });

/**
 * The "go do these" view: the agent's curated next actions as a checklist.
 * Check them off, say what happened, export the ones worth tracking to a
 * task list, then update the map from the results.
 */
export function NextSteps() {
  const s = usePathway();
  const plan = () => s.record().plan;
  // Tasks stay in place when checked off; they leave this list only once
  // "Update map from what happened" has taken in their results.
  const current = createMemo(
    () => plan()?.tasks.filter((t) => !t.absorbed) ?? [],
  );
  const open = createMemo(() => current().filter((t) => t.status === "todo"));
  const fresh = createMemo(() => current().filter((t) => t.status !== "todo"));
  const earlier = createMemo(
    () => plan()?.tasks.filter((t) => t.absorbed) ?? [],
  );
  const [showEarlier, setShowEarlier] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const minutes = () => open().reduce((sum, t) => sum + t.minutes, 0);

  const copy = async () => {
    const lines = open().map(
      (t) => `- [ ] ${t.title} (~${t.minutes} min). Done when: ${t.doneWhen}`,
    );
    await navigator.clipboard.writeText(
      `${s.record().title}\n\n${lines.join("\n")}\n`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  return (
    <div class={col}>
      <div>
        <Show
          when={plan()}
          fallback={
            <p class={lede}>
              The map is for exploring. This list is for doing: the agent picks
              the few actions most worth doing now from your goals, likes,
              notes, and where paths meet.
            </p>
          }
        >
          {(p) => (
            <>
              <p class={lede}>{p().summary}</p>
              <p class={meta}>
                {open().length} to do · about {Math.round(minutes() / 5) * 5}{" "}
                min · planned{" "}
                {new Date(p().createdAt).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </>
          )}
        </Show>
      </div>

      <AutoText
        key="plan:steer"
        value={s.steer()}
        delay={0}
        placeholder="Steer the plan (optional): “from home”, “2 hours”…"
        onSave={(v) => s.setSteer(v)}
      />
      <div class={actions}>
        <ActionButton
          primary={!fresh().length}
          label={plan() ? "Plan again" : "Plan next steps"}
          what="Picks the 3–7 best actions to do now. Finished tasks stay as history."
          busy={s.busy() === "map"}
          disabled={!!s.busy()}
          onClick={() => s.runAgent("plan", "root")}
        />
        <ActionButton
          primary={fresh().length > 0}
          label="Update map from what happened"
          what={
            fresh().length
              ? `Reads ${fresh().length} finished ${fresh().length === 1 ? "task" : "tasks"} and updates the map: chosen paths, ruled-out paths, new facts.`
              : "Check off tasks and say what happened first."
          }
          disabled={!!s.busy() || !fresh().length}
          onClick={() => s.runAgent("absorb", "root")}
        />
      </div>

      <Show when={current().length}>
        <div class={listHead}>
          <span class={label} style={{ flex: "1", "margin-top": "0" }}>
            {open().length} to do · {fresh().length} done
          </span>
          <div class={css({ display: "flex", gap: "1.5" })}>
            <button
              class={smallButton}
              data-on={String(exporting())}
              onClick={() => setExporting(!exporting())}
            >
              Export…
            </button>
            <button
              class={smallButton}
              onClick={copy}
              title="Copy the open tasks as a Markdown checklist"
            >
              {copied() ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
        <Show when={exporting()}>
          <ExportPicker tasks={open()} onDone={() => setExporting(false)} />
        </Show>
        <ol class={list}>
          {/* Keyed by id: every save clones the map, and object keys would rebuild the rows mid-typing. */}
          <For each={current().map((t) => t.id)}>
            {(id, i) => <TaskRow id={id} n={i() + 1} />}
          </For>
        </ol>
      </Show>

      <Show when={earlier().length}>
        <button
          class={cardLink}
          style={{ "margin-top": "8px" }}
          onClick={() => setShowEarlier(!showEarlier())}
        >
          {showEarlier() ? "Hide" : "Show"} {earlier().length} earlier{" "}
          {earlier().length === 1 ? "task" : "tasks"} already on the map
        </button>
        <Show when={showEarlier()}>
          <ol class={list}>
            <For each={earlier().map((t) => t.id)}>
              {(id) => <TaskRow id={id} />}
            </For>
          </ol>
        </Show>
      </Show>
    </div>
  );
}

function TaskRow(props: { id: string; n?: number }) {
  const s = usePathway();
  const blank: PlanTask = {
    id: "",
    title: "",
    why: "",
    doneWhen: "",
    minutes: 0,
    nodeIds: [],
    status: "todo",
    result: "",
  };
  const t = () =>
    s.record().plan?.tasks.find((x) => x.id === props.id) ?? blank;
  const cards = () =>
    t().nodeIds.flatMap((nid) =>
      s.record().graph.nodes.filter((n) => n.id === nid),
    );
  const linked = () =>
    t().taskId ? s.record().linked[t().taskId!] : undefined;
  const done = () => t().status === "done";
  // Checking a task off puts the cursor in "What happened?".
  const [ask, setAsk] = createSignal(0);

  return (
    <li
      class={task}
      data-done={String(done())}
      data-skipped={String(!!(t().status === "skipped"))}
    >
      <button
        class={check}
        title={done() ? "Mark as not done" : "Mark as done"}
        onClick={() => {
          const finishing = !done();
          s.updatePlanTask(t().id, { status: finishing ? "done" : "todo" });
          if (finishing && !t().result.trim()) setAsk((x) => x + 1);
        }}
      >
        {done() ? "✓" : props.n ?? "○"}
      </button>
      <div
        class={css({
          display: "flex",
          flexDirection: "column",
          gap: "1",
          minW: "0",
        })}
      >
        <div class={css({ display: "flex", alignItems: "baseline", gap: "2" })}>
          <div class={titleText} style={{ flex: "1" }}>
            {t().title}
          </div>
          <button
            class={textButton}
            title={
              t().status === "skipped"
                ? "Put back on the list"
                : "Skip: not doing this"
            }
            onClick={() =>
              s.updatePlanTask(t().id, {
                status: t().status === "skipped" ? "todo" : "skipped",
              })
            }
          >
            {t().status === "skipped" ? "Undo skip" : "Skip"}
          </button>
        </div>
        <div class={css({ fontSize: "xs", lineHeight: "1.45" })}>{t().why}</div>
        <div class={meta}>
          ~{t().minutes} min · Done when: {t().doneWhen}
          <Show when={linked()}>{(l) => <> · In tasks: {l().list}</>}</Show>
        </div>
        <Show when={cards().length}>
          <div class={meta}>
            Moves forward:{" "}
            <For each={cards()}>
              {(n, i) => (
                <>
                  {i() > 0 ? " · " : ""}
                  <button
                    class={cardLink}
                    style={{ "font-size": "inherit" }}
                    title="Show this card on the map"
                    onClick={() => s.setSelected(n.id)}
                  >
                    {n.title}
                  </button>
                </>
              )}
            </For>
          </div>
        </Show>
        <AutoText
          key={`${t().id}:result`}
          focusTick={ask()}
          value={t().result}
          placeholder={
            done()
              ? "What happened? Replies, facts, surprises. The map update reads this."
              : "What happened? Write it here once you do it."
          }
          onSave={(v, k) =>
            s.updatePlanTask(k!.split(":")[0], { result: v }, k)
          }
        />
      </div>
    </li>
  );
}
