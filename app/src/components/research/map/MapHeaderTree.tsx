import { ChevronRightIcon } from "lucide-solid";
import { createEffect, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import { CardGlyph } from "../cardTypeMeta";
import { barButtonClass, MapSearch } from "./MapToolbar";
import type { MapState } from "./createMapState";
import type { MapNode } from "./map-model";
import { CountLine } from "./MapCountLine";

const INDENT = 14;

const rowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  w: "full",
  minH: "11",
  pr: "2",
  textAlign: "left",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color",
  transitionDuration: "140ms",
  _hover: { bg: "bg.hover" },
  _active: { bg: "gray.a5" },
  _focusVisible: {
    outline: "2px solid token(colors.border.focus)",
    outlineOffset: "-2px",
  },
  "&[data-selected=true]": { bg: "bg.selected", color: "fg.selected" },
  "&[data-dimmed=true]": { opacity: 0.3 },
  "&[data-closed=true]": { color: "fg.muted" },
  "& [data-chevron]": {
    transitionProperty: "transform",
    transitionDuration: "140ms",
  },
  "&[aria-expanded=true] [data-chevron]": { transform: "rotate(90deg)" },
});

type RowProps = {
  node: MapNode;
  depth: number;
  state: MapState;
  query: string;
  onSelect: (cardId: string) => void;
};

/** One row. A branch folds; a card opens in the reader. A card with answers does both. */
const TreeRow = (props: RowProps) => {
  const open = () => props.state.isOpen(props.node.id);
  const hasKids = () => props.node.children.length > 0;
  const matches = () => {
    const counts = props.state.matchCounts();
    return counts ? counts.get(props.node.id) ?? 0 : undefined;
  };
  let row: HTMLButtonElement | undefined;
  // The reader takes the lower half here, so keep the picked row above it.
  createEffect(() => {
    if (props.state.selectedNode() !== props.node.id) return;
    requestAnimationFrame(() => row?.scrollIntoView({ block: "nearest" }));
  });
  const activate = () => {
    if (props.node.card) props.onSelect(props.node.card.id);
    if (hasKids()) props.state.setBranch(props.node.id, !open());
  };
  return (
    <li>
      <button
        ref={row}
        type="button"
        class={rowClass}
        style={{ "padding-left": `${props.depth * INDENT + 4}px` }}
        aria-expanded={hasKids() ? open() : undefined}
        data-testid="research-map-row"
        data-kind={props.node.kind}
        data-selected={props.state.selectedNode() === props.node.id}
        data-dimmed={props.state.isDimmed(props.node.id)}
        data-closed={
          props.node.card?.state === "done" ||
          props.node.card?.state === "dropped"
        }
        onClick={activate}
      >
        <span
          class={css({
            display: "inline-flex",
            w: "4",
            flexShrink: 0,
            color: "fg.subtle",
          })}
        >
          <Show when={hasKids()}>
            <span data-chevron class={css({ display: "inline-flex" })}>
              <ChevronRightIcon size={14} />
            </span>
          </Show>
        </span>
        <Show when={props.node.card}>
          {(card) => <CardGlyph card={card()} size={14} />}
        </Show>
        <span class={css({ minW: 0, flex: 1, py: "1" })}>
          <Show
            when={props.node.card}
            fallback={
              <span
                class={css({
                  display: "block",
                  fontSize: props.node.kind === "stream" ? "sm" : "xs",
                  fontWeight:
                    props.node.kind === "stream" ? "semibold" : "medium",
                  color:
                    props.node.kind === "stream" ? "fg.default" : "fg.muted",
                })}
              >
                {props.node.title}
                <Show when={props.node.kind === "section"}>
                  <span class={css({ color: "fg.subtle", ml: "1" })}>
                    {props.node.counts.total}
                  </span>
                </Show>
              </span>
            }
          >
            <span
              class={css({
                display: "block",
                fontSize: "sm",
                lineHeight: "1.3",
                lineClamp: 2,
              })}
            >
              <HighlightMatch text={props.node.title} query={props.query} />
            </span>
          </Show>
          <Show when={props.node.kind === "stream"}>
            <CountLine counts={props.node.counts} matches={matches()} />
          </Show>
        </span>
      </button>
      <Show when={hasKids() && open()}>
        <ul>
          <For each={props.node.children}>
            {(kid) => <TreeRow {...props} node={kid} depth={props.depth + 1} />}
          </For>
        </ul>
      </Show>
    </li>
  );
};

/** The phone map: the same condensed tree as a list of folding headers. */
export const MapHeaderTree = (props: {
  state: MapState;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (cardId: string) => void;
}) => (
  <div
    data-testid="research-map-tree"
    class={css({ h: "full", overflow: "auto", px: "3", pb: "3" })}
  >
    <div
      class={css({
        position: "sticky",
        top: 0,
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: "1",
        py: "2",
        bg: "bg.default",
      })}
    >
      <MapSearch
        query={props.query}
        found={props.state.foundCount()}
        onQuery={props.onQuery}
      />
      <button
        type="button"
        class={barButtonClass}
        onClick={() => props.state.collapseAll()}
      >
        Collapse
      </button>
    </div>
    <Show when={props.state.tree().root.goal}>
      {(answer) => (
        <p
          class={css({
            fontSize: "sm",
            color: "fg.muted",
            pb: "2",
            lineClamp: 3,
          })}
        >
          {answer()}
        </p>
      )}
    </Show>
    <ul>
      <For each={props.state.tree().root.children}>
        {(node) => (
          <TreeRow
            node={node}
            depth={0}
            state={props.state}
            query={props.query}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </ul>
  </div>
);
