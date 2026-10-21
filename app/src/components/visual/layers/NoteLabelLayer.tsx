import {
  For,
  Show,
  createMemo,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import type { DocItem } from "~/types/notes";
import type { NoteLabelLayout } from "../labels/note-label-layout";
import { NoteLabel } from "./NoteLabel";

type NoteLabelLayerProps = {
  layouts: Accessor<NoteLabelLayout[]>;
  docMap: Accessor<Map<string, DocItem>>;
  hoveredId: Accessor<string | undefined>;
  zoomScale: Accessor<number>;
  fontSize: Accessor<number>;
  noteOpacity: Accessor<number>;
  onPointerOverLabel: (docId: string | undefined) => void;
  onHoveredDocChange?: (id: string | undefined) => void;
  suppressNextOpen?: () => void;
  onSelectDoc: (id: string) => void;
};

export const NoteLabelLayer: VoidComponent<NoteLabelLayerProps> = (props) => (
  <Show when={props.layouts().length > 0}>
    <For each={props.layouts()}>
      {(layout) => {
        const doc = createMemo(() => props.docMap().get(layout.docId));
        const isHovered = createMemo(() => props.hoveredId() === layout.docId);
        return (
          <NoteLabel
            layout={layout}
            doc={doc}
            isHovered={isHovered}
            zoomScale={props.zoomScale}
            fontSize={props.fontSize}
            noteOpacity={props.noteOpacity}
            onPointerEnter={() => {
              props.onPointerOverLabel(layout.docId);
              props.onHoveredDocChange?.(layout.docId);
            }}
            onPointerLeave={() => {
              props.onPointerOverLabel(undefined);
              props.onHoveredDocChange?.(undefined);
            }}
            suppressNextOpen={props.suppressNextOpen}
            onSelect={() => props.onSelectDoc(layout.docId)}
          />
        );
      }}
    </For>
  </Show>
);
