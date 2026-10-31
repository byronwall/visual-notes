import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { css } from "styled-system/css";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { TopicData } from "../createTopicData";
import { relatedIds } from "./board-model";
import { BoardColumn, blockLabelClass } from "./BoardColumn";
import { BoardContext, type BoardDensity } from "./BoardContext";
import { BoardCardRow } from "./BoardCardRow";

const DENSITY_KEY = "research-board-density";

const toggleClass = css({
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
});

// The sidebar and the resizable reader set the board's width, so this measures
// the board, not the viewport. Criteria share the Answer's row only when both
// fit; otherwise they take a row of their own below it.
const criteriaClass = css({
  order: 1,
  flex: "1 0 100%",
  // Card rows carry their own inset; line them up with the Answer above.
  ml: "-2",
  "@container (min-width: 60rem)": {
    order: 0,
    flex: "none",
    w: "22rem",
    ml: "0",
  },
});

/**
 * The stream board: the topic's answer and criteria on top, then one fixed-width
 * column per stream. Positions come from the data alone, so nothing moves
 * unless cards above it in its own column change.
 */
export const TopicBoard = (props: {
  data: TopicData;
  selectedId: string | null;
  selectedStream: string | null;
  matches: Set<string> | null;
  onSelect: (id: string) => void;
  onSelectStream: (key: string) => void;
}) => {
  const [density, setDensity] = createSignal<BoardDensity>("compact");
  const [hovered, setHovered] = createSignal<string | null>(null);
  // A saved density applies after mount: only the browser knows it.
  onMount(() => {
    try {
      if (localStorage.getItem(DENSITY_KEY) === "detailed")
        setDensity("detailed");
    } catch {
      // Storage can be blocked; stay compact.
    }
  });
  const chooseDensity = (next: BoardDensity) => {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  };

  const board = () => props.data.board();
  // Hover wins; otherwise the selected card's relations stay highlighted.
  const related = createMemo(() => {
    const id = hovered() ?? props.selectedId;
    const card = id ? props.data.cardsById().get(id) : undefined;
    return card ? relatedIds(board(), card) : new Set<string>();
  });
  const topic = () => props.data.current()?.topic;
  const answerHtml = () =>
    topic()?.answer.trim() ? normalizeMarkdownToHtml(topic()!.answer) : "";

  return (
    <BoardContext.Provider
      value={{
        get data() {
          return props.data;
        },
        selectedId: () => props.selectedId,
        onSelect: (id) => props.onSelect(id),
        density,
        setHovered,
        isRelated: (id) => related().has(id),
        matches: () => props.matches,
      }}
    >
      <div
        class={css({
          h: "full",
          overflow: "auto",
          "--board-col-w": "22rem",
          "&[data-density=compact]": { "--board-col-w": "17rem" },
        })}
        data-density={density()}
        data-testid="research-board"
      >
        <div
          class={css({
            containerType: "inline-size",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            columnGap: "6",
            rowGap: "2",
            px: "4",
            pt: "3",
            pb: "2",
          })}
        >
          <div class={css({ flex: "1 1 16rem", minW: 0, maxW: "56rem" })}>
            <h2 class={blockLabelClass} style={{ "padding-left": 0 }}>
              Answer
            </h2>
            <Show
              when={answerHtml()}
              fallback={
                <p class={css({ fontSize: "sm", color: "fg.muted" })}>
                  No answer yet. Agents keep it current as streams settle.
                </p>
              }
            >
              <div
                class={css({
                  fontSize: "sm",
                  color: "fg.default",
                  "& p + p": { mt: "1" },
                  "& a": { color: "fg.link" },
                })}
                innerHTML={answerHtml()}
              />
            </Show>
          </div>
          <Show when={board().topicCriteria.length}>
            <div class={criteriaClass}>
              <h2 class={blockLabelClass}>
                Criteria{" "}
                <span class={css({ color: "fg.subtle" })}>
                  {board().topicCriteria.length}
                </span>
              </h2>
              <For each={board().topicCriteria}>
                {(card) => <BoardCardRow node={{ card, children: [] }} />}
              </For>
            </div>
          </Show>
          <div
            role="group"
            aria-label="Density"
            class={css({
              display: "flex",
              gap: "0.5",
              flex: "none",
              ml: "auto",
            })}
          >
            <button
              type="button"
              class={toggleClass}
              data-active={density() === "detailed"}
              onClick={() => chooseDensity("detailed")}
            >
              Detailed
            </button>
            <button
              type="button"
              class={toggleClass}
              data-active={density() === "compact"}
              onClick={() => chooseDensity("compact")}
            >
              Compact
            </button>
          </div>
        </div>
        <div
          class={css({
            display: "flex",
            alignItems: "stretch",
            px: "2",
            minW: "max-content",
          })}
        >
          <For each={board().columns}>
            {(model) => (
              <BoardColumn
                model={model}
                selectedStream={props.selectedStream}
                onSelectStream={props.onSelectStream}
              />
            )}
          </For>
        </div>
      </div>
    </BoardContext.Provider>
  );
};
