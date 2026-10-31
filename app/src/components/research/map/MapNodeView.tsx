import { ChevronRightIcon } from "lucide-solid";
import { Match, Show, Switch } from "solid-js";
import { css } from "styled-system/css";
import { HighlightMatch } from "~/components/archive/list/HighlightMatch";
import { CardGlyph } from "../cardTypeMeta";
import type { MapBox } from "./map-layout";
import { CountLine } from "./MapCountLine";
import type { MapNode } from "./map-model";
import {
  chevronClass,
  clampClass,
  countButtonClass,
  metaClass,
  nodeClass,
  streamHeadClass,
} from "./mapNodeStyles";

/** One node, at a fixed size. Only titles and counts live here; text waits for the reader. */
export const MapNodeView = (props: {
  node: MapNode;
  box: MapBox;
  open: boolean;
  focused: boolean;
  selected: boolean;
  dimmed: boolean;
  query: string;
  matches: number | undefined;
  onPick: () => void;
  onToggle: () => void;
}) => {
  const node = () => props.node;
  const branch = () => node().children.length > 0 && node().kind !== "root";
  const closed = () =>
    node().card?.state === "done" || node().card?.state === "dropped";
  return (
    <div
      role="treeitem"
      tabIndex={props.focused ? 0 : -1}
      class={nodeClass}
      style={{
        width: `${props.box.w}px`,
        height: `${props.box.h}px`,
        transform: `translate(${props.box.x}px, ${props.box.y}px)`,
      }}
      aria-level={props.box.depth + 1}
      aria-label={node().title}
      aria-expanded={branch() ? props.open : undefined}
      aria-selected={props.selected}
      data-testid="research-map-node"
      data-node-id={node().id}
      data-kind={node().kind}
      data-side={props.box.side}
      data-selected={props.selected}
      data-closed={closed()}
      data-dimmed={props.dimmed}
      onClick={() => props.onPick()}
    >
      <Switch>
        <Match when={node().kind === "root"}>
          <span
            class={css({
              fontSize: "md",
              fontWeight: "semibold",
              lineHeight: "1.25",
              lineClamp: 2,
            })}
            data-map-title
          >
            {node().title}
          </span>
          <Show when={node().goal}>
            <span
              class={css({
                fontSize: "xs",
                color: "fg.muted",
                lineHeight: "1.3",
                lineClamp: 2,
              })}
              data-map-title
            >
              {node().goal}
            </span>
          </Show>
          <span class={metaClass}>
            <Show when={node().counts.open}>
              <span class={css({ color: "amber.11" })}>
                {node().counts.open} open
              </span>
            </Show>
            <span>
              {node().counts.total}{" "}
              {node().counts.total === 1 ? "card" : "cards"}
            </span>
          </span>
        </Match>
        <Match when={node().kind === "stream"}>
          <span
            class={css({
              minW: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "1",
            })}
          >
            <span class={streamHeadClass}>
              <span
                class={css({
                  minW: 0,
                  flex: 1,
                  fontSize: "sm",
                  fontWeight: "semibold",
                  lineHeight: "18px",
                  lineClamp: 2,
                })}
                data-map-title
              >
                <HighlightMatch text={node().title} query={props.query} />
              </span>
              <span class={chevronClass}>
                <ChevronRightIcon size={14} />
              </span>
            </span>
            <CountLine counts={node().counts} matches={props.matches} />
          </span>
        </Match>
        <Match when={node().kind === "section"}>
          <span>{node().title}</span>
          <span
            class={css({
              color: "fg.subtle",
              fontVariantNumeric: "tabular-nums",
            })}
          >
            {node().counts.total}
          </span>
        </Match>
        <Match when={node().card}>
          {(card) => (
            <>
              <CardGlyph card={card()} size={14} />
              <span
                class={clampClass}
                style={{
                  "text-decoration":
                    card().state === "dropped" ? "line-through" : undefined,
                }}
                data-map-title
              >
                <HighlightMatch text={node().title} query={props.query} />
              </span>
              <Show when={branch()}>
                <button
                  type="button"
                  tabIndex={-1}
                  class={countButtonClass}
                  aria-label={
                    props.open
                      ? "Collapse"
                      : `Expand ${node().children.length} below`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onToggle();
                  }}
                >
                  {props.open ? "−" : `+${node().children.length}`}
                </button>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
};
