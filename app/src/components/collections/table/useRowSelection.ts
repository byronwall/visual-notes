import { createSignal, type Accessor } from "solid-js";
import type { CollectionRow } from "~/lib/collections/types";

/** Row checkboxes: toggle, Shift-click ranges, and select all. */
export function useRowSelection(rows: Accessor<CollectionRow[]>) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [anchor, setAnchor] = createSignal<string | null>(null);

  const toggle = (id: string, shift: boolean) => {
    const next = new Set(selected());
    const from = anchor();
    if (shift && from) {
      const ids = rows().map((r) => r.id);
      const [a, b] = [ids.indexOf(from), ids.indexOf(id)].sort((x, y) => x - y);
      for (const rid of ids.slice(a, b + 1)) next.add(rid);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setAnchor(id);
  };
  const allSelected = () =>
    rows().length > 0 && rows().every((r) => selected().has(r.id));
  const toggleAll = () =>
    setSelected(
      allSelected() ? new Set<string>() : new Set(rows().map((r) => r.id)),
    );
  const selectedIds = () =>
    rows()
      .filter((r) => selected().has(r.id))
      .map((r) => r.id);

  return {
    isSelected: (id: string) => selected().has(id),
    count: () => selected().size,
    toggle,
    allSelected,
    toggleAll,
    selectedIds,
    clear: () => setSelected(new Set<string>()),
  };
}
