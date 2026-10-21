import { For, createMemo, type Accessor, type VoidComponent } from "solid-js";
import type { DocItem } from "~/types/notes";
import type { PlacedNoteLabel } from "../useCanvasNoteLabels";
import type { FadeEntry } from "../useCrossFade";
import { NoteLabel } from "./NoteLabel";

type NoteLabelLayerProps = {
  labels: Accessor<FadeEntry<PlacedNoteLabel>[]>;
  docMap: Accessor<Map<string, DocItem>>;
  hoveredId: Accessor<string | undefined>;
  zoomScale: Accessor<number>;
  /** Extra fade while the live zoom is far out from the planned zoom. */
  gestureFade: Accessor<number>;
  noteOpacity: Accessor<number>;
  onPointerOverLabel: (docId: string | undefined) => void;
  onHoveredDocChange?: (id: string | undefined) => void;
  suppressNextOpen?: () => void;
  onSelectDoc: (id: string) => void;
};

export const NoteLabelLayer: VoidComponent<NoteLabelLayerProps> = (props) => (
  <g opacity={props.gestureFade()}>
    <For each={props.labels()}>
      {(entry) => {
        const placed = entry.item();
        const docId = placed.layout.docId;
        const doc = createMemo(() => props.docMap().get(docId));
        const isHovered = createMemo(() => props.hoveredId() === docId);
        return (
          <NoteLabel
            layout={entry.item().layout}
            layoutZoom={entry.item().layoutZoom}
            liveZoom={props.zoomScale}
            visible={entry.visible}
            doc={doc}
            isHovered={isHovered}
            noteOpacity={props.noteOpacity}
            onPointerEnter={() => {
              props.onPointerOverLabel(docId);
              props.onHoveredDocChange?.(docId);
            }}
            onPointerLeave={() => {
              props.onPointerOverLabel(undefined);
              props.onHoveredDocChange?.(undefined);
            }}
            suppressNextOpen={props.suppressNextOpen}
            onSelect={() => props.onSelectDoc(docId)}
          />
        );
      }}
    </For>
  </g>
);
