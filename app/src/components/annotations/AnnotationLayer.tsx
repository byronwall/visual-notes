import type { Editor } from "@tiptap/core";
import { revalidate, useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type VoidComponent,
} from "solid-js";
import {
  anchorChanges,
  annotationKey,
  annotationRanges,
  createAnnotationPlugin,
  setAnnotationsMeta,
  type Range,
} from "~/components/editor/annotations/annotationPlugin";
import type { AnnotationColor } from "~/lib/annotations/types";
import { saveAnnotationAnchors } from "~/services/annotations/annotations.actions";
import {
  fetchAnnotationTypes,
  fetchNoteAnnotations,
} from "~/services/annotations/annotations.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationRail } from "./AnnotationRail";
import { AnnotationTypesDialog } from "./AnnotationTypesDialog";
import {
  AnnotationLayerContext,
  type AnnotationLayerApi,
} from "./annotation-context";

// Typed highlights on a note: the editor plugin, the selection composer,
// and the rail. Anchors are saved right after the note's content saves, so
// the stored quote always matches the stored note.

const LOG_PREFIX = "[annotations]";

export const AnnotationLayer: VoidComponent<{
  docId: string;
  editor: Editor | undefined;
  /** Receives the function to call after each successful content save. */
  onFlushReady?: (flush: () => Promise<void>) => void;
}> = (props) => {
  const typesData = createKeptAsync(() => fetchAnnotationTypes(), onDemand);
  const notesData = createKeptAsync(() => fetchNoteAnnotations(props.docId), onDemand);
  const runSaveAnchors = useAction(saveAnnotationAnchors);
  const [activeId, setActiveId] = createSignal<string | null>(null);
  const [ranges, setRanges] = createSignal(new Map<string, Range>(), { equals: false });
  const [typesOpen, setTypesOpen] = createSignal(false);

  const types = () => typesData.latest ?? [];
  const annotations = () => notesData.latest ?? [];
  const colors = createMemo(() => {
    const out: Record<string, AnnotationColor> = {};
    for (const type of types()) out[type.id] = type.color;
    return out;
  });
  const editor = () => (props.editor && !props.editor.isDestroyed ? props.editor : undefined);
  const refresh = () => void revalidate(fetchNoteAnnotations.keyFor(props.docId));

  createEffect(() => {
    const ed = editor();
    if (!ed) return;
    ed.registerPlugin(
      createAnnotationPlugin({ select: (id) => setActiveId(id) }),
    );
    const onTransaction = () => setRanges(annotationRanges(ed.state));
    ed.on("transaction", onTransaction);
    onCleanup(() => {
      ed.off("transaction", onTransaction);
      if (!ed.isDestroyed) ed.unregisterPlugin(annotationKey);
    });
  });

  createEffect(() => {
    const ed = editor();
    const input = { annotations: annotations(), colors: colors(), activeId: activeId() };
    if (!ed) return;
    const [meta, value] = setAnnotationsMeta(input);
    ed.view.dispatch(ed.state.tr.setMeta(meta, value).setMeta("addToHistory", false));
  });

  const flush = async () => {
    const ed = editor();
    if (!ed) return;
    const updates = anchorChanges(ed.state);
    if (updates.length === 0) return;
    try {
      await runSaveAnchors({ docId: props.docId, updates });
      console.debug(`${LOG_PREFIX} saved anchors`, { count: updates.length });
      refresh();
    } catch (error) {
      console.warn(`${LOG_PREFIX} anchor save failed`, error);
    }
  };
  props.onFlushReady?.(flush);

  const reveal = (id: string) => {
    setActiveId(id);
    const ed = editor();
    const range = ranges().get(id);
    if (!ed || !range) return;
    const { node } = ed.view.domAtPos(range.from);
    const el = node instanceof Element ? node : node.parentElement;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const api: AnnotationLayerApi = {
    docId: props.docId,
    editor,
    types,
    annotations,
    ranges,
    activeId,
    setActive: setActiveId,
    reveal,
    refresh,
    openTypes: () => setTypesOpen(true),
  };

  return (
    <AnnotationLayerContext.Provider value={api}>
      <AnnotationComposer />
      <AnnotationRail />
      <AnnotationTypesDialog open={typesOpen()} onClose={() => setTypesOpen(false)} />
    </AnnotationLayerContext.Provider>
  );
};
