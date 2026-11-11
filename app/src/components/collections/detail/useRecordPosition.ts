import { createMemo } from "solid-js";

/**
 * Where the open record sits in the view's current order, and its neighbors.
 * A record that an edit drops out of the results keeps its last slot, so
 * Previous/Next continue from where it was.
 */
export const useRecordPosition = (
  rowId: () => string | null,
  order: () => readonly string[],
) => {
  const index = createMemo(() => {
    const id = rowId();
    return id ? order().indexOf(id) : -1;
  });
  const anchor = createMemo<{ id: string | null; i: number }>((prev) => {
    const id = rowId();
    const i = index();
    return i >= 0 || prev?.id !== id ? { id, i } : prev;
  });
  const inView = () => index() >= 0;
  const prevId = () =>
    order()[(inView() ? index() : anchor().i) - 1] as string | undefined;
  const nextId = () =>
    order()[inView() ? index() + 1 : Math.max(anchor().i, 0)] as
      | string
      | undefined;
  const label = () => `${inView() ? index() + 1 : "–"} of ${order().length}`;
  return { inView, prevId, nextId, label };
};
