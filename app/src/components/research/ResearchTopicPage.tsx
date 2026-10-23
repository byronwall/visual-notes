import { A, useSearchParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { countOpen } from "~/services/research/research.graph";
import { TopicCanvas } from "./canvas/TopicCanvas";
import { createTopicData } from "./createTopicData";
import { CardDetailPanel } from "./detail/CardDetailPanel";
import { TopicBatchList } from "./TopicBatchList";
import { TopicOutline } from "./TopicOutline";
import { TopicTitle } from "./TopicTitle";

const crumbLinkClass = css({ color: "fg.link", textDecoration: "none", _hover: { color: "fg.linkHover" } });

const tabClass = css({
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": { bg: "bg.selected", color: "fg.selected", fontWeight: "medium" },
});

const VIEWS = [
  { id: "canvas", label: "Canvas" },
  { id: "outline", label: "Outline" },
] as const;

export const ResearchTopicPage = (props: { slug: string }) => {
  const data = createTopicData(() => props.slug);
  const [params, setParams] = useSearchParams<{ view?: string; card?: string }>();
  const view = () => (params.view === "outline" ? "outline" : "canvas");
  const nowMs = () => Date.parse(data.current()?.generatedAt ?? "") || 0;
  const selected = () => (params.card ? (data.cardsById().get(params.card) ?? null) : null);
  const select = (id: string | null) => setParams({ card: id ?? undefined }, { replace: true });
  const plainCount = () => data.cards().filter((card) => card.type !== "summary").length;

  return (
    <Show
      when={data.current()}
      fallback={
        <Show when={data.graph.state === "ready"}>
          <p class={css({ p: "6", color: "fg.muted" })}>
            Topic not found. <A href="/research" class={crumbLinkClass}>Back to Research</A>
          </p>
        </Show>
      }
    >
      {(graph) => (
        <div class={css({ display: "flex", flexDirection: "column", h: "100dvh", minH: 0 })}>
          <header
            class={css({
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              rowGap: "1",
              columnGap: "3",
              px: "4",
              py: "1.5",
              borderBottomWidth: "1px",
              borderColor: "border",
            })}
          >
            <nav aria-label="Breadcrumb" class={css({ fontSize: "sm", display: "flex", alignItems: "center", gap: "1.5", minW: 0 })}>
              <A href="/research" class={crumbLinkClass}>Research</A>
              <span class={css({ color: "fg.subtle" })}>/</span>
              <TopicTitle topic={graph().topic} onChanged={data.reload} />
            </nav>
            <span class={css({ fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums", flex: 1 })}>
              <span class={css({ color: "amber.11" })}>{countOpen(data.cards())} open</span> · {plainCount()} cards
            </span>
            <div role="tablist" aria-label="Topic view" class={css({ display: "flex", gap: "0.5" })}>
              <For each={VIEWS}>
                {(entry) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view() === entry.id}
                    class={tabClass}
                    data-active={view() === entry.id}
                    onClick={() => setParams({ view: entry.id === "canvas" ? undefined : entry.id }, { replace: true })}
                  >
                    {entry.label}
                  </button>
                )}
              </For>
            </div>
          </header>
          <div
            class={css({
              flex: 1,
              minH: 0,
              display: "grid",
              gridTemplateColumns: { base: "1fr", lg: "minmax(0, 1fr) 20rem" },
              gridTemplateRows: { base: "minmax(0, 1fr) auto", lg: "minmax(0, 1fr)" },
            })}
          >
            <main class={css({ minH: 0, overflow: view() === "canvas" ? "hidden" : "auto" })}>
              <Show
                when={data.cards().length}
                fallback={<p class={css({ color: "fg.muted", fontSize: "sm", p: "4" })}>Empty topic. Point an agent at it to start.</p>}
              >
                <Show when={view() === "canvas"} fallback={<div class={css({ px: "3", py: "2" })}><TopicOutline data={data} selectedId={selected()?.id ?? null} onSelect={select} /></div>}>
                  <TopicCanvas data={data} selectedId={selected()?.id ?? null} onSelect={select} />
                </Show>
              </Show>
            </main>
            <aside
              class={css({
                borderLeftWidth: { lg: "1px" },
                borderTopWidth: { base: "1px", lg: "0" },
                borderColor: "border",
                overflowY: "auto",
                maxH: { base: "45dvh", lg: "none" },
                px: "3",
                py: "2",
              })}
            >
              <Show when={selected()} fallback={<TopicBatchList data={data} nowMs={nowMs()} />}>
                {(card) => <CardDetailPanel data={data} card={card()} onSelect={select} />}
              </Show>
            </aside>
          </div>
        </div>
      )}
    </Show>
  );
};
