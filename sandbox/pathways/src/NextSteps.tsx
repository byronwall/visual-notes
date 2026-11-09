import { createMemo, createSignal, For, Show } from "solid-js";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { ChangeCard } from "./ChangeCard";
import { busy, change, map, runAgent, setSteer, showOnMap, steer, updateTask } from "./state";
import type { PlanTask } from "./types";

/**
 * The "go do these" view: the agent's curated next actions as a checklist.
 * You check them off, say what happened, then update the map from the results.
 */
export function NextSteps() {
  const plan = () => map()?.plan;
  const open = createMemo(() => plan()?.tasks.filter((t) => t.status === "todo") ?? []);
  // Tasks stay in place when checked off. They leave this list only once
  // "Update map from what happened" has taken in their results.
  const current = createMemo(() => plan()?.tasks.filter((t) => !t.absorbed) ?? []);
  const fresh = createMemo(() => current().filter((t) => t.status !== "todo"));
  const earlier = createMemo(() => plan()?.tasks.filter((t) => t.status !== "todo" && t.absorbed) ?? []);
  const [showEarlier, setShowEarlier] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const minutes = () => open().reduce((s, t) => s + t.minutes, 0);

  const copy = async () => {
    const lines = open().map((t) => `- [ ] ${t.title} (~${t.minutes} min). Done when: ${t.doneWhen}`);
    await navigator.clipboard.writeText(`${map()?.title}\n\n${lines.join("\n")}\n`);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  return (
    <div class="next">
      <div class="next-col">
        <div class="next-head">
          <h1>Next steps</h1>
          <Show
            when={plan()}
            fallback={
              <p class="lede">
                The map is for exploring. This list is for doing: the agent picks the few actions most worth doing now
                from your goals, likes, notes, and where paths meet.
              </p>
            }
          >
            {(p) => (
              <>
                <p class="lede">{p().summary}</p>
                <p class="muted">
                  {open().length} to do · about {Math.round(minutes() / 5) * 5} min · planned{" "}
                  {new Date(p().createdAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </>
            )}
          </Show>
        </div>

        {/* A plan run's summary is already the lede; show the card for map updates only. */}
        <Show when={change() && !change()!.planned}>
          <ChangeCard />
        </Show>

        <AutoText
          key="plan:steer"
          value={steer()}
          delay={0}
          placeholder="Steer the plan (optional): “only things I can do from home”, “two hours this week”"
          onSave={(v) => setSteer(v)}
        />
        <div class="actions row">
          <ActionButton
            primary={!fresh().length}
            label={plan() ? "Plan again" : "Plan next steps"}
            what="Picks the 3–7 best actions to do now. Finished tasks stay as history."
            busy={busy() === "map"}
            disabled={!!busy()}
            onClick={() => runAgent("plan", "root")}
          />
          <ActionButton
            primary={fresh().length > 0}
            label="Update map from what happened"
            what={
              fresh().length
                ? `Reads ${fresh().length} finished ${fresh().length === 1 ? "task" : "tasks"} and updates the map: chosen paths, ruled-out paths, new facts.`
                : "Check off tasks and say what happened first."
            }
            disabled={!!busy() || !fresh().length}
            onClick={() => runAgent("absorb", "root")}
          />
        </div>

        <Show when={current().length}>
          <div class="list-head">
            <h2>
              {open().length} to do · {fresh().length} done or skipped
            </h2>
            <button class="copy" classList={{ copied: copied() }} onClick={copy} title="Copy the open tasks as a Markdown checklist">
              {copied() ? "✓ Copied" : "Copy as checklist"}
            </button>
          </div>
          <ol class="tasks">
            {/* Keyed by id: every save clones the map, and object keys would rebuild the rows mid-typing. */}
            <For each={current().map((t) => t.id)}>{(id, i) => <TaskRow id={id} n={i() + 1} />}</For>
          </ol>
        </Show>

        <Show when={earlier().length}>
          <button class="link earlier" onClick={() => setShowEarlier(!showEarlier())}>
            {showEarlier() ? "Hide" : "Show"} {earlier().length} earlier {earlier().length === 1 ? "task" : "tasks"} already on the map
          </button>
          <Show when={showEarlier()}>
            <ol class="tasks">
              <For each={earlier().map((t) => t.id)}>{(id) => <TaskRow id={id} />}</For>
            </ol>
          </Show>
        </Show>
      </div>
    </div>
  );
}

function TaskRow(props: { id: string; n?: number }) {
  const blank: PlanTask = { id: "", title: "", why: "", doneWhen: "", minutes: 0, nodeIds: [], status: "todo", result: "" };
  const t = () => map()?.plan?.tasks.find((x) => x.id === props.id) ?? blank;
  // Checking a task off puts the cursor in "What happened?".
  const [ask, setAsk] = createSignal(0);
  const cards = () => t().nodeIds.map((id) => map()?.nodes.find((n) => n.id === id)).filter((n) => !!n);
  const done = () => t().status === "done";
  return (
    <li class="task" classList={{ done: done(), skipped: t().status === "skipped" }}>
      <button
        class="check"
        title={done() ? "Mark as not done" : "Mark as done"}
        onClick={() => {
          const finishing = !done();
          updateTask(t().id, { status: finishing ? "done" : "todo", absorbed: false });
          if (finishing && !t().result.trim()) setAsk((x) => x + 1);
        }}
      >
        {done() ? "✓" : props.n ?? "○"}
      </button>
      <div class="task-body">
        <div class="task-title">{t().title}</div>
        <div class="task-why">{t().why}</div>
        <div class="task-meta">
          ~{t().minutes} min · Done when: {t().doneWhen}
        </div>
        <Show when={cards().length}>
          <div class="task-cards">
            Moves forward:{" "}
            <For each={cards()}>
              {(n, i) => (
                <>
                  {i() > 0 ? " · " : ""}
                  <button class="link" onClick={() => showOnMap(n!.id)}>
                    {n!.title}
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
          placeholder={done() ? "What happened? Replies, facts, surprises. The map update reads this." : "What happened? Write it here once you do it."}
          onSave={(v, k) => updateTask(k!.split(":")[0], { result: v, absorbed: false })}
        />
      </div>
      <button
        class="skip"
        title={t().status === "skipped" ? "Put back on the list" : "Skip: not doing this"}
        onClick={() => updateTask(t().id, { status: t().status === "skipped" ? "todo" : "skipped", absorbed: false })}
      >
        {t().status === "skipped" ? "Undo skip" : "Skip"}
      </button>
    </li>
  );
}
