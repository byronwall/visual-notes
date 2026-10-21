import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { FoldView } from "../layout/fold";
import { edgePath, type Rect } from "../layout/tree-layout";

const svgClass = css({
  position: "absolute",
  left: 0,
  top: 0,
  width: "1px",
  height: "1px",
  overflow: "visible",
  pointerEvents: "none",
  "& path": { fill: "none", transitionProperty: "d", transitionDuration: "200ms" },
  "@media (prefers-reduced-motion: reduce)": { "& path": { transitionProperty: "none" } },
});

/** Came-from edges (solid), relates-to links (dashed blue), extra came-from edges for the selection. */
export const CanvasEdges = (props: {
  view: FoldView;
  rects: Map<string, Rect>;
  factor: number;
  selectedId: string | null;
}) => {
  const tree = () =>
    [...props.view.parent.entries()]
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([child, parent]) => ({ child, parent }));
  const stroke = () => Math.max(1, props.factor) * 1.25;
  // Extra came-from edges into a summary only show for the selected card; drawn
  // all at once they cut across the columns.
  const extra = () =>
    props.view.edges.filter(
      (edge) => edge.kind === "relates" || edge.from === props.selectedId || edge.to === props.selectedId,
    );

  return (
    <svg class={svgClass} aria-hidden="true">
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
