import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { NoteLabelLayout } from "./labels/note-label-layout";

const CLEAR_DELAY_MS = 140;

/**
 * Keeps the hovered note's label on screen after the pointer leaves the dot,
 * so the pointer can travel onto the label and click it. The label clears
 * 140 ms after the pointer is on neither the dot nor the label.
 */
export function useFrozenHoveredNoteLabel(
  anchoredLayout: Accessor<NoteLabelLayout | null>,
) {
  const [pointerOverNoteLabelId, setPointerOverNoteLabelId] = createSignal<
    string | undefined
  >(undefined);
  const [frozenLayout, setFrozenLayout] = createSignal<NoteLabelLayout | null>(
    null,
  );
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelClear = () => {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = undefined;
    }
  };

  createEffect(() => {
    const anchored = anchoredLayout();
    if (anchored) {
      cancelClear();
      setFrozenLayout(anchored);
      return;
    }
    const pointerLabelId = pointerOverNoteLabelId();
    const frozen = frozenLayout();
    if (pointerLabelId && frozen?.docId === pointerLabelId) {
      cancelClear();
      return;
    }
    cancelClear();
    if (!frozen) return;
    const frozenDocId = frozen.docId;
    clearTimer = setTimeout(() => {
      setFrozenLayout((current) =>
        current && !pointerOverNoteLabelId() && current.docId === frozenDocId
          ? null
          : current,
      );
      clearTimer = undefined;
    }, CLEAR_DELAY_MS);
  });
  onCleanup(cancelClear);

  /** The anchored label, or the frozen one while the pointer is on it. */
  const activeLayout = createMemo(() => {
    const anchored = anchoredLayout();
    if (anchored) return anchored;
    const pointerLabelId = pointerOverNoteLabelId();
    const frozen = frozenLayout();
    if (pointerLabelId && frozen?.docId === pointerLabelId) {
      return frozen;
    }
    return null;
  });

  const reset = () => {
    setPointerOverNoteLabelId(undefined);
    setFrozenLayout(null);
  };

  return { activeLayout, setPointerOverNoteLabelId, reset };
}
