import {
  For,
  Show,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { colorFor } from "~/utils/colors";
import { seededPositionFor } from "~/layout/seeded";

type Point = { x: number; y: number };

type PanZoomHandlers = {
  onWheel: (e: WheelEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
};

type DocItem = {
  id: string;
  title: string;
  createdAt: string;
};

export type VisualCanvasProps = {
  docs: Accessor<DocItem[] | undefined>;
  positions: Accessor<Map<string, Point>>;
  hoveredId: Accessor<string | undefined>;
  hoveredLabelScreen: Accessor<
    { x: number; y: number; title: string } | undefined
  >;
  showHoverLabel: Accessor<boolean>;
  viewTransform: Accessor<string>;
  navHeight: Accessor<number>;
  eventHandlers: PanZoomHandlers;
  onSelectDoc: (id: string) => void;
};

const SPREAD = 1000;

export const VisualCanvas: VoidComponent<VisualCanvasProps> = (props) => {
  return (
    <div
      class="fixed overflow-hidden bg-white"
      style={{
        position: "fixed",
        left: "0",
        right: "0",
        bottom: "0",
        top: `${props.navHeight()}px`,
      }}
      onWheel={props.eventHandlers.onWheel}
      onPointerDown={props.eventHandlers.onPointerDown}
      onPointerMove={props.eventHandlers.onPointerMove}
      onPointerUp={props.eventHandlers.onPointerUp}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: "block", background: "white" }}
      >
        <g transform={props.viewTransform()}>
          <Show when={props.docs()}>
            {(list) => (
              <For each={list()}>
                {(d, i) => {
                  const pos = createMemo(
                    () =>
                      props.positions().get(d.id) ??
                      seededPositionFor(d.title, i(), SPREAD)
                  );
                  const fill = colorFor(d.title);
                  const isHovered = createMemo(
                    () => props.hoveredId() === d.id && props.showHoverLabel()
                  );
                  return (
                    <g>
                      <circle
                        cx={pos().x}
                        cy={pos().y}
                        r={10}
                        fill={fill}
                        stroke={isHovered() ? "#111" : "#00000020"}
                        stroke-width={isHovered() ? 2 : 1}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onSelectDoc(d.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    </g>
                  );
                }}
              </For>
            )}
          </Show>
        </g>
      </svg>
      <Show when={props.hoveredLabelScreen()}>
        {(lbl) => (
          <div
            class="absolute"
            style={{
              left: `${lbl().x + 12}px`,
              top: `${lbl().y - 10}px`,
              "pointer-events": "none",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.98)",
                border: "1px solid rgba(0,0,0,0.15)",
                padding: "4px 8px",
                "border-radius": "6px",
                "box-shadow": "0 2px 6px rgba(0,0,0,0.08)",
                color: "#111",
                "font-size": "14px",
                "max-width": "320px",
                "white-space": "nowrap",
                "text-overflow": "ellipsis",
                overflow: "hidden",
              }}
            >
              {lbl().title}
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default VisualCanvas;
