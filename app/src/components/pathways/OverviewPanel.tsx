import { createMemo, Index, Show } from "solid-js";
import { css } from "styled-system/css";
import { meetingPoints } from "~/lib/pathways/plan";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { EdgeList } from "./NodePanel";
import { usePathway } from "./pathway-state";
import { help, iconX, label, section } from "./styles";

const question = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1.5",
  fontSize: "xs",
  color: "fg.muted",
  "&[data-open=true]": { color: "fg.default", fontWeight: "semibold" },
});

/**
 * The side panel when no card is selected: your goals, and indexes into the
 * map (where paths meet, important, research). Whole-map agent actions live
 * in the header (MapAgentMenu).
 */
export function OverviewPanel() {
  const s = usePathway();
  const nodes = () => s.record().graph.nodes;
  const ctx = () => s.record().context ?? { notes: "", qa: [] };
  const id = () => s.record().id;
  const votes = createMemo(() => ({
    like: nodes().filter((n) => n.feedback?.vote === "like").length,
    no: nodes().filter((n) => n.feedback?.vote === "no").length,
    more: nodes().filter((n) => n.feedback?.vote === "more").length,
    notes: nodes().filter((n) => n.feedback?.comment.trim()).length,
  }));
  const anyFeedback = () =>
    votes().like + votes().no + votes().more + votes().notes > 0;
  const meets = createMemo(() => meetingPoints(s.record().graph));
  const title = (nid: string) =>
    nodes().find((n) => n.id === nid)?.title ?? nid;
  const important = createMemo(() =>
    nodes()
      .filter((n) => n.weight === "key")
      .map((n) => n.id),
  );
  const research = createMemo(() =>
    nodes()
      .filter((n) => n.research && n.research.status !== "done")
      .map((n) => n.id),
  );
  const run = (
    a: "converge" | "options" | "questions" | "improve" | "regenerate",
  ) => s.runAgent(a, "root");

  return (
    <>
      <div class={section}>
        <span class={label}>Goals &amp; vibes</span>
        <AutoText
          key={`${id()}:notes`}
          minRows={3}
          maxHeight={360}
          placeholder="What matters to you here? What would a good month look like? What feels heavy?"
          value={ctx().notes}
          onSave={(v, k) =>
            k === `${id()}:notes` && s.setContext((c) => (c.notes = v), "notes")
          }
        />
        <Index each={ctx().qa}>
          {(qa, i) => (
            <div
              class={css({
                display: "flex",
                flexDirection: "column",
                gap: "1",
              })}
            >
              <div class={question} data-open={String(!qa().a.trim())}>
                <span style={{ flex: "1" }}>{qa().q}</span>
                <button
                  class={iconX}
                  title="Remove this question"
                  onClick={() => s.setContext((c) => c.qa.splice(i, 1))}
                >
                  ×
                </button>
              </div>
              <AutoText
                key={`${id()}:qa:${qa().q}`}
                maxHeight={240}
                placeholder="Your answer"
                value={qa().a}
                onSave={(v, k) =>
                  s.setContext((c) => {
                    const hit = c.qa.find((x) => `${id()}:qa:${x.q}` === k);
                    if (hit) hit.a = v;
                  }, `qa:${i}`)
                }
              />
            </div>
          )}
        </Index>
        <ActionButton
          label={ctx().qa.length ? "Ask me more" : "Ask me about my goals"}
          what="Adds 3–4 questions about what you want. Every agent action reads your answers."
          disabled={!!s.busy()}
          onClick={() => run("questions")}
        />
      </div>

      <div class={section}>
        <span class={label}>Your feedback</span>
        <p class={help}>
          <Show
            when={anyFeedback()}
            fallback="Select a card to react (1 like · 2 not for me · 3 want better · 4 important · 5 noise) or write your thoughts on it."
          >
            {votes().like} liked · {votes().no} not for me · {votes().more} want
            better · {votes().notes} notes
          </Show>
        </p>
      </div>

      <Show when={important().length}>
        <div class={section}>
          <span class={label}>Important</span>
          <EdgeList ids={important()} title={title} />
        </div>
      </Show>
      <div class={section}>
        <span class={label}>Where paths meet</span>
        <Show
          when={meets().length}
          fallback={<p class={help}>No shared cards yet.</p>}
        >
          <EdgeList
            ids={meets().map((m) => m.id)}
            title={title}
            count={(nid) =>
              `${meets().find((m) => m.id === nid)?.paths ?? 0} paths`
            }
          />
        </Show>
      </div>
      <Show when={research().length}>
        <div class={section}>
          <span class={label}>Needs research</span>
          <EdgeList ids={research()} title={title} />
        </div>
      </Show>
    </>
  );
}
