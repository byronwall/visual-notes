import { createMemo, Show } from "solid-js";
import { meetingPoints } from "~/lib/pathways/plan";
import { GoalsSection } from "./GoalsSection";
import { EdgeList } from "./EdgeList";
import { usePathway } from "./pathway-state";
import { help, label, section } from "./styles";

/**
 * The side panel when no card is selected: your goals, and indexes into the
 * map (where paths meet, important, research). Whole-map agent actions live
 * in the header (MapAgentMenu).
 */
export function OverviewPanel() {
  const s = usePathway();
  const nodes = () => s.record().graph.nodes;
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

  return (
    <>
      <GoalsSection />

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
