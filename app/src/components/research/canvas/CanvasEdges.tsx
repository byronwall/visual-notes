import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { FoldView } from "../layout/fold";
import { edgePath, type LaneLabel, type Rect } from "../layout/tree-layout";

const svgClass = css({
  position: "absolute",
  left: 0,
  top: 0,
  width: "1px",
  height: "1px",
  overflow: "visible",
  pointerEvents: "none",
  transitionProperty: "opacity",
  transitionDuration: "200ms",
  "& path": { fill: "none", transitionProperty: "d", transitionDuration: "200ms" },
  "@media (prefers-reduced-motion: reduce)": { "& path": { transitionProperty: "none" } },
});

/**
 * Came-from edges (solid; one per laned block), plus relates-to links (dashed
 * blue) and extra came-from edges, which only show for the selected card.
 */
export const CanvasEdges = (props: {
  view: FoldView;
  rects: Map<string, Rect>;
  lanes: LaneLabel[];
  laned: Set<string>;
  factor: number;
  selectedId: string | null;
  /** A search is active: edges step back so matching cards stand out. */
  searching: boolean;
}) => {
  const tree = () =>
    [...props.view.parent.entries()]
      .filter((entry): entry is [string, string] => entry[1] !== null && !props.laned.has(entry[0]))
      .map(([child, parent]) => ({ child, parent }));
  const blocks = () => props.lanes.filter((lane) => lane.first);
  const stroke = () => Math.max(1, props.factor) * 1.25;
  // Drawn all at once these cut across the columns, so only the selection's show.
  const extra = () => props.view.edges.filter((edge) => edge.from === props.selectedId || edge.to === props.selectedId);

  return (
    <svg class={svgClass} aria-hidden="true" style={{ opacity: props.searching ? 0.35 : 1 }}>
      <For each={tree()}>
        {(edge) => (
          <Show when={props.rects.get(edge.parent) && props.rects.get(edge.child)}>
            <path
              d={edgePath(props.rects.get(edge.parent)!, props.rects.get(edge.child)!)}
              stroke="var(--colors-gray-a7)"
              stroke-width={stroke()}
            />
          </Show>
        )}
      </For>
      <For each={blocks()}>
        {(lane) => (
          <Show when={props.rects.get(lane.parentId)}>
            {(parent) => (
              <path d={edgePath(parent(), lane.rect)} stroke="var(--colors-gray-a7)" stroke-width={stroke()} />
            )}
          </Show>
        )}
      </For>
      <For each={extra()}>
        {(edge) => (
          <Show when={props.rects.get(edge.from) && props.rects.get(edge.to)}>
            <path
              d={edgePath(props.rects.get(edge.from)!, props.rects.get(edge.to)!)}
              stroke={edge.kind === "relates" ? "var(--colors-blue-a7)" : "var(--colors-gray-a6)"}
              stroke-width={stroke()}
              stroke-dasharray={`${4 * props.factor} ${4 * props.factor}`}
              data-edge-kind={edge.kind}
            />
          </Show>
        )}
      </For>
    </svg>
  );
};
