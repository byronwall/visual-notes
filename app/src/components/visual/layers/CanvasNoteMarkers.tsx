import { Show, createMemo, type Accessor, type VoidComponent } from "solid-js";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";
import { colorFor } from "~/utils/colors";
import { SPREAD, type Point } from "../labels/label-geometry";

type CanvasNoteMarkersProps = {
  docs: Accessor<DocItem[]>;
  positions: Accessor<Map<string, Point>>;
  hoveredId: Accessor<string | undefined>;
  activeDocId?: Accessor<string | undefined>;
  matchingDocIds?: Accessor<Set<string> | null>;
  zoomScale: Accessor<number>;
  circleRadius: Accessor<number>;
  noteOpacity: Accessor<number>;
  onSelectDoc: (id: string) => void;
};

/** The enlarged hovered dot and the ring around the note open in the panel. */
export const CanvasNoteMarkers: VoidComponent<CanvasNoteMarkersProps> = (
  props,
) => (
  <>
    <Show
      when={(() => {
        const hoveredId = props.hoveredId();
        if (!hoveredId) return null;
        const doc = props.docs().find((item) => item.id === hoveredId);
        if (!doc) return null;
        const matching = props.matchingDocIds?.();
        if (matching && !matching.has(doc.id)) return null;
        return doc;
      })()}
    >
      {(doc) => <HoveredNoteDot doc={doc} {...props} />}
    </Show>
    <Show
      when={(() => {
        const id = props.activeDocId?.();
        if (!id) return undefined;
        return props.positions().get(id);
      })()}
    >
      {(pos) => (
        <circle
          cx={pos().x}
          cy={pos().y}
          r={Math.max(9 / props.zoomScale(), props.circleRadius() * 2.1)}
          fill="none"
          stroke="#1D4ED8"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          style={{ "pointer-events": "none" }}
        />
      )}
    </Show>
  </>
);

const HoveredNoteDot: VoidComponent<
  CanvasNoteMarkersProps & { doc: Accessor<DocItem> }
> = (props) => {
  const pos = createMemo(() => {
    const listIndex = props
      .docs()
      .findIndex((item) => item.id === props.doc().id);
    return (
      props.positions().get(props.doc().id) ??
      seededPositionFor(props.doc().title, Math.max(0, listIndex), SPREAD)
    );
  });
  const fill = createMemo(() =>
    colorFor(props.doc().path || props.doc().title),
  );
  const hoverRadius = createMemo(() =>
    Math.max(
      7.5 / props.zoomScale(),
      Math.min(12 / props.zoomScale(), props.circleRadius() * 1.95),
    ),
  );
  const pointerEvents = () => (props.noteOpacity() > 0.08 ? "auto" : "none");
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onSelectDoc(props.doc().id);
  };
  return (
    <g>
      <circle
        cx={pos().x}
        cy={pos().y}
        r={hoverRadius()}
        fill="var(--colors-bg-default)"
        stroke="rgba(37, 99, 235, 0.28)"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        filter="url(#canvas-hover-note-shadow)"
        style={{ cursor: "pointer", "pointer-events": pointerEvents() }}
        onClick={onClick}
      />
      <circle
        cx={pos().x}
        cy={pos().y}
        r={hoverRadius() * 0.68}
        fill={fill()}
        stroke="#1D4ED8"
        stroke-width="2.5"
        vector-effect="non-scaling-stroke"
        style={{ cursor: "pointer", "pointer-events": pointerEvents() }}
        onClick={onClick}
      />
    </g>
  );
};
