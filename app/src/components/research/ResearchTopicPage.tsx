import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { css } from "styled-system/css";
import { countOpen } from "~/services/research/research.graph";
import { createTopicData } from "./createTopicData";
import { TopicBatchList } from "./TopicBatchList";
import { TopicOutline } from "./TopicOutline";

const crumbLinkClass = css({ color: "blue.11", textDecoration: "none", _hover: { color: "blue.12" } });

export const ResearchTopicPage = (props: { slug: string }) => {
  const data = createTopicData(() => props.slug);
  const nowMs = () => Date.parse(data.current()?.generatedAt ?? "") || 0;

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
              alignItems: "baseline",
              gap: "3",
              px: "4",
              py: "2",
              borderBottomWidth: "1px",
              borderColor: "border",
            })}
          >
            <nav aria-label="Breadcrumb" class={css({ fontSize: "sm", display: "flex", gap: "1.5", minW: 0 })}>
              <A href="/research" class={crumbLinkClass}>Research</A>
              <span class={css({ color: "fg.subtle" })}>/</span>
              <h1 class={css({ fontWeight: "semibold" })}>{graph().topic.title}</h1>
            </nav>
            <span class={css({ fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" })}>
              <span class={css({ color: "amber.11" })}>{countOpen(data.cards())} open</span> · {data.cards().filter((card) => card.type !== "summary").length} cards
            </span>
          </header>
          <div
            class={css({
              flex: 1,
              minH: 0,
              display: "grid",
              gridTemplateColumns: { base: "1fr", lg: "minmax(0, 1fr) 18rem" },
            })}
          >
            <main class={css({ overflowY: "auto", px: "3", py: "2" })}>
              <Show
                when={data.cards().length}
                fallback={<p class={css({ color: "fg.muted", fontSize: "sm", p: "3" })}>Empty topic. Point an agent at it to start.</p>}
              >
                <TopicOutline data={data} />
              </Show>
            </main>
            <aside
              class={css({
                borderLeftWidth: { lg: "1px" },
                borderTopWidth: { base: "1px", lg: "0" },
                borderColor: "border",
                overflowY: "auto",
                px: "3",
                py: "2",
              })}
            >
              <TopicBatchList data={data} nowMs={nowMs()} />
            </aside>
          </div>
        </div>
      )}
    </Show>
  );
};
