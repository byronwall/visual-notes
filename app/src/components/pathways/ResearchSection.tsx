import { createMemo, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PathwayNode, Source } from "~/lib/pathways/types";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { Markdown } from "./Markdown";
import { EdgeList } from "./EdgeList";
import { usePathway } from "./pathway-state";
import { cardLink, help, iconX, label, section, smallButton } from "./styles";

const wrap = css({ display: "flex", flexWrap: "wrap", gap: "1.5" });
const sourceRow = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "3",
  rowGap: "1",
  fontSize: "xs",
});

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function SourceLinks(props: { list: Source[] }) {
  return (
    <Show when={props.list.length}>
      <div class={sourceRow}>
        <span class={help}>Sources</span>
        <For each={props.list}>
          {(src) => (
            <a
              class={cardLink}
              style={{ "max-width": "100%" }}
              href={src.url}
              target="_blank"
              rel="noreferrer"
              title={src.url}
            >
              {src.title || hostOf(src.url)}
            </a>
          )}
        </For>
      </div>
    </Show>
  );
}

/** A card's research question, its findings, and the cards built from them. */
export function ResearchSection(props: { n: PathwayNode }) {
  const s = usePathway();
  const r = () => props.n.research;
  const id = () => props.n.id;
  const graph = () => s.record().graph;
  const built = createMemo(() =>
    graph()
      // Done and dropped cards are hidden from the map, so they are not listed.
      .nodes.filter(
        (x) =>
          x.fromResearch?.nodeId === id() &&
          (x.status === "open" || x.status === "chosen"),
      )
      .map((x) => x.id),
  );
  const title = (cardId: string) =>
    graph().nodes.find((x) => x.id === cardId)?.title ?? cardId;

  return (
    <div class={section}>
      <span class={label}>Research</span>
      <Show
        when={r()}
        fallback={
          <button
            class={smallButton}
            style={{ "align-self": "flex-start" }}
            onClick={() =>
              s.setResearch(id(), {
                question: `What do I need to know to act on: ${props.n.title}?`,
                status: "suggested",
              })
            }
          >
            Needs research…
          </button>
        }
      >
        <AutoText
          key={`${id()}:research`}
          value={r()!.question}
          placeholder="What do you need to find out?"
          onSave={(v, k) => {
            const t = graph().nodes.find((x) => `${x.id}:research` === k);
            if (t?.research && v.trim())
              s.setResearch(t.id, { ...t.research, question: v.trim() });
          }}
          onSubmit={() => queueMicrotask(() => s.runResearch(id()))}
        />
        <div class={wrap}>
          <button
            class={smallButton}
            disabled={!!s.busy()}
            onClick={() => s.runResearch(id())}
            title="OpenAI web search, about 30–60 seconds"
          >
            {s.busy() === `research:${id()}`
              ? "Searching the web…"
              : r()!.status === "done"
                ? "Research again"
                : "Research now"}
          </button>
          <button
            class={smallButton}
            data-on={String(!!(r()!.status === "queued"))}
            title="Leave it for Claude or ChatGPT: pathways_get lists the research queue"
            onClick={() =>
              s.setResearch(id(), {
                ...r()!,
                status: r()!.status === "queued" ? "suggested" : "queued",
              })
            }
          >
            {r()!.status === "queued"
              ? "Queued for an agent"
              : "Queue for an agent"}
          </button>
          <button
            class={iconX}
            title="Remove the research question"
            onClick={() => s.setResearch(id(), undefined)}
          >
            ×
          </button>
        </div>
        <Show when={r()!.findings}>
          <Markdown text={r()!.findings!} />
          <SourceLinks list={r()!.sources ?? []} />
          <p class={help}>From {r()!.by ?? "research"}.</p>
          <ActionButton
            primary
            label={built().length ? "Add to map again" : "Add findings to map"}
            what="Adds steps and options built on these findings, and notes the findings on cards they change. Each new card links back here."
            busy={s.busy() === `research-map:${id()}`}
            disabled={!!s.busy()}
            onClick={() => s.runAgent("fromResearch", id(), "")}
          />
          <Show when={built().length}>
            <span class={help}>
              On the map · {built().length}{" "}
              {built().length === 1 ? "card" : "cards"} from this research
            </span>
            <EdgeList ids={built()} title={title} />
          </Show>
        </Show>
      </Show>
    </div>
  );
}

/** On a card built from research: where it came from and the pages it relies on. */
export function ResearchBasisSection(props: { n: PathwayNode }) {
  const s = usePathway();
  const basis = () => props.n.fromResearch!;
  const origin = () =>
    s.record().graph.nodes.find((x) => x.id === basis().nodeId);
  return (
    <div class={section}>
      <span class={label}>From research</span>
      <Show
        when={origin()}
        fallback={<p class={help}>Built from research on a deleted card.</p>}
      >
        {(o) => (
          <p class={help}>
            Built from the findings on{" "}
            <button class={cardLink} onClick={() => s.setSelected(o().id)}>
              {o().title}
            </button>
          </p>
        )}
      </Show>
      <SourceLinks list={basis().sources} />
    </div>
  );
}
