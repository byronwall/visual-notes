import type { Editor } from "@tiptap/core";
import { createContext, useContext, type Accessor } from "solid-js";
import type { Range } from "~/components/editor/annotations/annotationPlugin";
import type {
  AnnotationTypeView,
  AnnotationView,
} from "~/lib/annotations/types";

/** What the annotation rail, composer, and entries share for one note. */
export type AnnotationLayerApi = {
  docId: string;
  editor: Accessor<Editor | undefined>;
  types: Accessor<AnnotationTypeView[]>;
  annotations: Accessor<AnnotationView[]>;
  /** Live highlight ranges, refreshed on every editor transaction. */
  ranges: Accessor<Map<string, Range>>;
  activeId: Accessor<string | null>;
  setActive: (id: string | null) => void;
  /** The annotation under the pointer, in the rail or the note. */
  hoverId: Accessor<string | null>;
  setHover: (id: string | null) => void;
  /** A type picked in the legend: only its annotations show. */
  focusType: Accessor<string | null>;
  setFocusType: (id: string | null) => void;
  /** Scrolls the note to an annotation's highlight and marks it active. */
  reveal: (id: string) => void;
  refresh: () => void;
  openTypes: () => void;
};

export const AnnotationLayerContext = createContext<AnnotationLayerApi>();

export const useAnnotationLayer = () => {
  const api = useContext(AnnotationLayerContext);
  if (!api) throw new Error("useAnnotationLayer outside AnnotationLayer");
  return api;
};

/** Inline style for a type's color dot or bar. */
export const swatchStyle = (color: string, step: number | string = 9) => ({
  "background-color": `var(--colors-${color}-${step})`,
});
