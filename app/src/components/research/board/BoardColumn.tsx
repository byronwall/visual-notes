import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import { UNSORTED_ID } from "~/services/research/research.streams";
import { BLOCK_LABEL, type BoardColumnModel } from "./board-model";
import { BoardCardRow } from "./BoardCardRow";
import { useBoard } from "./BoardContext";

const columnClass = css({
  flex: "none",
  w: "var(--board-col-w)",
  display: "flex",
  flexDirection: "column",
  gap: "3",
  pb: "6",
  px: "2",
  "& + &": { borderLeftWidth: "1px", borderColor: "border" },
});

const headerClass = css({
  position: "sticky",
  top: 0,
  zIndex: 1,
  bg: "bg.default",
  px: "2",
  pt: "3",
  pb: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
  cursor: "pointer",
  textAlign: "left",
  w: "full",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  "&[data-selected=true]": { bg: "bg.selected" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
});

export const blockLabelClass = css({
  px: "2",
  mb: "0.5",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.muted",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontVariantNumeric: "tabular-nums",
});

const answerClass = css({
  px: "2",
  fontSize: "sm",
  color: "fg.default",
  lineClamp: 6,
  "& p + p": { mt: "1" },
  "& ul": { listStyle: "disc", pl: "5" },
  "& a": { color: "fg.link" },
});

/** One stream: its header (opens the stream in the reader), answer, then fixed blocks. */
export const BoardColumn = (props: {
  model: BoardColumnModel;
  selectedStream: string | null;
  onSelectStream: (key: string) => void;
}) => {
  const board = useBoard();
  const column = () => props.model.column;
  const unsorted = () => column().id === UNSORTED_ID;
  const selectable = () => !column().virtual && !unsorted();
  const answerHtml = () =>
    column().answer.trim() ? normalizeMarkdownToHtml(column().answer) : "";
  const sources = () =>
    props.model.blocks.find((block) => block.key === "sources");

  return (
    <section
      class={columnClass}
      aria-label={column().title}
      data-testid="research-board-column"
      data-stream={column().key}
    >
      <button
        type="button"
        class={headerClass}
        data-selected={props.selectedStream === column().key}
        disabled={!selectable()}
        onClick={() => selectable() && props.onSelectStream(column().key)}
        title={selectable() ? "Open this stream in the reader" : undefined}
        style={selectable() ? undefined : { cursor: "default" }}
      >
        <h2
          class={css({
            fontSize: "md",
            fontWeight: "semibold",
            lineHeight: "1.3",
            color: unsorted() ? "fg.muted" : "fg.default",
          })}
        >
          {column().title}
        </h2>
        <Show when={column().goal}>
          <p
            class={css({
              fontSize: "sm",
              color: "fg.muted",
              mt: "0.5",
              lineHeight: "1.35",
            })}
          >
            {column().goal}
          </p>
        </Show>
        <p
          class={css({
            fontSize: "xs",
            color: "fg.muted",
            mt: "1",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          <span
            class={css({
              color: props.model.openCount ? "amber.11" : undefined,
            })}
          >
            {props.model.openCount} open
          </span>{" "}
          · {props.model.cardCount}{" "}
          {props.model.cardCount === 1 ? "card" : "cards"}
        </p>
      </button>

      <Show when={answerHtml()}>
        <div>
          <h3 class={blockLabelClass}>Answer</h3>
          <div class={answerClass} innerHTML={answerHtml()} />
        </div>
      </Show>

      <For each={props.model.blocks.filter((block) => block.key !== "sources")}>
        {(block) => (
          <div>
            <h3 class={blockLabelClass}>
              {BLOCK_LABEL[block.key]}{" "}
              <span class={css({ color: "fg.subtle" })}>
                {block.nodes.length}
              </span>
            </h3>
            <For each={block.nodes}>
              {(node) => <BoardCardRow node={node} />}
            </For>
          </div>
        )}
      </For>

      <Show when={sources()}>
        {(block) => (
          <div>
            <h3 class={blockLabelClass}>
              Sources{" "}
              <span class={css({ color: "fg.subtle" })}>
                {block().nodes.length}
              </span>
            </h3>
            <ul class={css({ display: "flex", flexDirection: "column" })}>
              <For each={block().nodes}>
                {(node) => (
                  <li>
                    <button
                      type="button"
                      class={css({
                        display: "block",
                        w: "full",
                        px: "2",
                        py: "1",
                        fontSize: "sm",
                        textAlign: "left",
                        color: "fg.link",
                        borderRadius: "l2",
                        cursor: "pointer",
                        transitionProperty: "background-color",
                        transitionDuration: "140ms",
                        _hover: { bg: "bg.hover", color: "fg.linkHover" },
                        "&[data-selected=true]": { bg: "bg.selected" },
                      })}
                      data-testid="research-board-card"
                      data-card-id={node.card.id}
                      data-selected={board.selectedId() === node.card.id}
                      onClick={() => board.onSelect(node.card.id)}
                    >
                      {node.card.title}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </Show>
    </section>
  );
};
