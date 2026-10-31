import { LinkIcon, MessageSquareIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { kindLabel, orderedFields } from "~/services/research/research.kinds";
import { CardGlyph } from "../cardTypeMeta";
import type { BoardNode } from "./board-model";
import { useBoard } from "./BoardContext";

/** Markdown body to one plain run of text, for cards written before gists existed. */
export const plainExcerpt = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const rowClass = css({
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr)",
  columnGap: "2",
  px: "2",
  py: "1.5",
  borderRadius: "l2",
  cursor: "pointer",
  textAlign: "left",
  w: "full",
  transitionProperty: "background-color, opacity",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  "&[data-related=true]": { bg: "blue.a3" },
  "&[data-selected=true]": { bg: "bg.selected" },
  "&[data-closed=true]": { opacity: 0.6 },
  "&[data-dimmed=true]": { opacity: 0.3 },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
  "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
});

const titleClass = css({
  fontSize: "sm",
  fontWeight: "medium",
  color: "fg.default",
  lineHeight: "1.35",
  "[data-closed=true] &": {
    textDecoration: "line-through",
    textDecorationColor: "fg.subtle",
  },
  "[data-depth='1'] &, [data-depth='2'] &, [data-depth='3'] &": {
    fontWeight: "normal",
  },
});

const metaClass = css({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "2.5",
  rowGap: "0.5",
  mt: "0.5",
  fontSize: "xs",
  color: "fg.muted",
  "& > span": { display: "inline-flex", alignItems: "center", gap: "1" },
});

/**
 * One card on the board: a status glyph on the left rail, the full title,
 * then (in detailed density) its gist, fields, and relations, with answers
 * or results nested underneath.
 */
export const BoardCardRow = (props: { node: BoardNode; depth?: number }) => {
  const board = useBoard();
  const card = () => props.node.card;
  const depth = () => props.depth ?? 0;
  const graph = () => board.data.current();
  const relations = () => board.data.board().relations;
  const kinds = () => graph()?.topic.kinds ?? [];
  const label = () => kindLabel(kinds(), card().kind);
  const fields = () => orderedFields(kinds(), card());
  const blockers = () => relations().blockers.get(card().id) ?? [];
  const openBlockers = () =>
    blockers().filter((entry) => entry.card.state === "open");
  const citations = () => relations().citations.get(card().id)?.length ?? 0;
  const comments = () =>
    (graph()?.comments ?? []).filter(
      (c) => c.cardId === card().id && !c.resolvedAt,
    ).length;
  const detailed = () => board.density() === "detailed";
  const dimmed = () => {
    const matches = board.matches();
    return matches !== null && !matches.has(card().id);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        class={rowClass}
        style={
          depth()
            ? {
                "padding-left": `calc(${Math.min(depth(), 3)} * 1.5rem + 0.5rem)`,
              }
            : undefined
        }
        data-testid="research-board-card"
        data-card-id={card().id}
        data-depth={depth()}
        data-selected={board.selectedId() === card().id}
        data-related={board.isRelated(card().id)}
        data-closed={card().state === "done" || card().state === "dropped"}
        data-dimmed={dimmed()}
        onClick={() => board.onSelect(card().id)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          board.onSelect(card().id);
        }}
        onPointerEnter={() => board.setHovered(card().id)}
        onPointerLeave={() => board.setHovered(null)}
      >
        <span class={css({ pt: "0.5" })}>
          <CardGlyph card={card()} size={14} />
        </span>
        <div class={css({ minW: 0 })}>
          <div class={titleClass}>
            <Show when={label()}>
              <span
                class={css({
                  color: "fg.muted",
                  fontWeight: "normal",
                  mr: "1.5",
                })}
              >
                {label()}
              </span>
            </Show>
            {card().title}
          </div>
          <Show
            when={detailed() && card().gist}
            fallback={
              // No gist yet: a three-line excerpt; the reader has the whole body.
              <Show when={detailed() && card().body}>
                <p
                  class={css({
                    fontSize: "sm",
                    color: "fg.muted",
                    lineHeight: "1.4",
                    mt: "0.5",
                    lineClamp: 3,
                  })}
                >
                  {plainExcerpt(card().body)}
                </p>
              </Show>
            }
          >
            <p
              class={css({
                fontSize: "sm",
                color: "fg.muted",
                lineHeight: "1.4",
                mt: "0.5",
              })}
            >
              {card().gist}
            </p>
          </Show>
          <Show when={detailed() && fields().length}>
            <dl class={metaClass}>
              <For each={fields()}>
                {(field) => (
                  <span>
                    <dt>{field.label}</dt>
                    <dd
                      class={css({
                        color: "fg.default",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {field.value}
                    </dd>
                  </span>
                )}
              </For>
            </dl>
          </Show>
          <Show
            when={
              openBlockers().length ||
              citations() ||
              comments() ||
              (!detailed() && blockers().length)
            }
          >
            <div class={metaClass}>
              <For each={detailed() ? openBlockers() : []}>
                {(entry) => (
                  <span
                    class={css({ color: "amber.11" })}
                    title={entry.card.title}
                  >
                    {entry.kind === "blocks" ? "Blocked by" : "Open"}:{" "}
                    {entry.card.title}
                  </span>
                )}
              </For>
              <Show when={!detailed() && openBlockers().length}>
                <span class={css({ color: "amber.11" })}>
                  {openBlockers().length} open blocker
                  {openBlockers().length === 1 ? "" : "s"}
                </span>
              </Show>
              <Show when={citations()}>
                <span>
                  <LinkIcon size={11} />
                  {citations()} source{citations() === 1 ? "" : "s"}
                </span>
              </Show>
              <Show when={comments()}>
                <span class={css({ color: "fg.default" })}>
                  <MessageSquareIcon size={11} />
                  {comments()}
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <For each={props.node.children}>
        {(child) => <BoardCardRow node={child} depth={depth() + 1} />}
      </For>
    </div>
  );
};
