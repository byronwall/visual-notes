import {
  For,
  Show,
  createEffect,
  createMemo,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { createMapView } from "~/components/research/map/createMapView";
import {
  radialLayout,
  type NetEdge,
  type NetPerson,
} from "~/lib/people/network-layout";

const viewport = css({
  position: "relative",
  overflow: "hidden",
  h: { base: "24rem", md: "34rem" },
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l3",
  bg: "bg.subtle",
  touchAction: "none",
  cursor: "grab",
  "&[data-dragging]": { cursor: "grabbing" },
  "&[data-expanded]": {
    position: "fixed",
    inset: "0",
    h: "auto",
    zIndex: "modal",
    borderRadius: "0",
    bg: "bg.default",
  },
});
const world = css({
  position: "absolute",
  left: "50%",
  top: "50%",
  transformOrigin: "0 0",
});
const glide = css({ transition: "transform 0.2s ease" });
const controls = css({
  position: "absolute",
  top: "2",
  right: "2",
  display: "flex",
  gap: "1",
  bg: "bg.default",
  borderRadius: "l2",
  p: "1",
  boxShadow: "sm",
  zIndex: "1",
});
const edgeLine = css({ stroke: "var(--colors-border)", strokeWidth: "1.5" });
const edgeOnPath = css({
  stroke: "var(--colors-fg-default)",
  strokeWidth: "2.5",
});
const edgeLabel = css({ fontSize: "11px", fill: "var(--colors-fg-muted)" });
const edgeLabelBg = css({
  fill: "var(--colors-bg-default)",
  stroke: "var(--colors-border)",
  strokeWidth: "0.5",
});
const node = css({ cursor: "pointer" });
const nodeBox = css({
  fill: "var(--colors-bg-default)",
  stroke: "var(--colors-border)",
  strokeWidth: "1",
  "[data-selected] &": { stroke: "var(--colors-fg-default)", strokeWidth: "2" },
  "[data-center] &": { fill: "var(--colors-fg-default)" },
});
const nodeText = css({
  fontSize: "13px",
  fill: "var(--colors-fg-default)",
  "[data-center] &": { fill: "var(--colors-bg-default)", fontWeight: "600" },
});

const BOX_H = 30;
const boxW = (name: string) => Math.min(190, 24 + name.length * 7.2);
const short = (name: string) =>
  name.length > 24 ? `${name.slice(0, 23)}…` : name;

/** The focused network with readable edge labels, pan, and pointer-centered zoom. */
export function NetworkGraph(props: {
  centerId: string;
  people: NetPerson[];
  edges: NetEdge[];
  selectedId: string | null;
  pathEdgeIds: Set<string>;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpanded: () => void;
}) {
  const view = createMapView();
  const layout = createMemo(() =>
    radialLayout(props.people, props.edges, props.centerId),
  );
  // Fit when the focus changes, and whenever the viewport's size changes
  // (first layout, expand / close, window resize).
  let host: HTMLDivElement | undefined;
  createEffect(
    on(
      () => [props.centerId, props.people.length],
      () => requestAnimationFrame(() => view.fit(layout().bounds)),
    ),
  );
  onMount(() => {
    if (!host) return;
    const observer = new ResizeObserver(() => view.fit(layout().bounds));
    observer.observe(host);
    onCleanup(() => observer.disconnect());
    // Escape closes the full-window view.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.expanded) props.onToggleExpanded();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div
      class={viewport}
      ref={(el) => {
        host = el;
        view.attach(el);
      }}
      data-dragging={view.dragging() ? "" : undefined}
      data-expanded={props.expanded ? "" : undefined}
      data-network-graph
      onPointerDown={view.onPointerDown}
    >
      {/* Pointer-down here must not start a pan, or the pan's pointer capture
          swallows the button's click. */}
      <div class={controls} onPointerDown={(e) => e.stopPropagation()}>
        <Button
          size="xs"
          variant="plain"
          aria-label="Zoom in"
          onClick={() => view.zoomBy(1.25)}
        >
          +
        </Button>
        <Button
          size="xs"
          variant="plain"
          aria-label="Zoom out"
          onClick={() => view.zoomBy(0.8)}
        >
          −
        </Button>
        <Button
          size="xs"
          variant="plain"
          onClick={() => view.fit(layout().bounds)}
        >
          Fit
        </Button>
        <Button
          size="xs"
          variant="plain"
          onClick={() => props.onToggleExpanded()}
        >
          {props.expanded ? "Close" : "Expand"}
        </Button>
      </div>
      <div
        class={`${world} ${view.gliding() ? glide : ""}`}
        style={{
          transform: `translate(${view.pan().x}px, ${view.pan().y}px) scale(${view.zoom()})`,
        }}
      >
        <svg
          style={{ overflow: "visible", position: "absolute" }}
          width="1"
          height="1"
          aria-hidden="true"
        >
          <For each={props.edges}>
            {(e) => {
              const a = () => layout().byId.get(e.from);
              const b = () => layout().byId.get(e.to);
              return (
                <Show when={a() && b()}>
                  <line
                    class={props.pathEdgeIds.has(e.id) ? edgeOnPath : edgeLine}
                    x1={a()!.x}
                    y1={a()!.y}
                    x2={b()!.x}
                    y2={b()!.y}
                  />
                </Show>
              );
            }}
          </For>
          {/* Labels after every line, so no line crosses a label. */}
          <For each={props.edges}>
            {(e) => {
              const a = () => layout().byId.get(e.from);
              const b = () => layout().byId.get(e.to);
              const mid = () => ({
                x: ((a()?.x ?? 0) + (b()?.x ?? 0)) / 2,
                y: ((a()?.y ?? 0) + (b()?.y ?? 0)) / 2,
              });
              const w = () => e.label.length * 6 + 10;
              return (
                <Show when={a() && b()}>
                  <g data-edge={e.label}>
                    <rect
                      class={edgeLabelBg}
                      x={mid().x - w() / 2}
                      y={mid().y - 8}
                      width={w()}
                      height={16}
                      rx={4}
                    />
                    <text
                      class={edgeLabel}
                      x={mid().x}
                      y={mid().y + 4}
                      text-anchor="middle"
                    >
                      {e.label}
                    </text>
                  </g>
                </Show>
              );
            }}
          </For>
          <For each={layout().nodes}>
            {(n) => (
              <g
                class={node}
                data-node-id={n.id}
                data-person-node={n.displayName}
                data-selected={props.selectedId === n.id ? "" : undefined}
                data-center={n.id === props.centerId ? "" : undefined}
                onClick={() => props.onSelect(n.id)}
              >
                <rect
                  class={nodeBox}
                  x={n.x - boxW(n.displayName) / 2}
                  y={n.y - BOX_H / 2}
                  width={boxW(n.displayName)}
                  height={BOX_H}
                  rx={8}
                />
                <text class={nodeText} x={n.x} y={n.y + 4} text-anchor="middle">
                  {short(n.displayName)}
                </text>
                <title>{n.displayName}</title>
              </g>
            )}
          </For>
        </svg>
      </div>
    </div>
  );
}
