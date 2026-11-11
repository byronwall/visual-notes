/**
 * Optimistic writes, one cell at a time. A cell is a row field: a property
 * value, the title, or the rank. Each write gets a sequence number per cell,
 * so a failed write undoes only the cells it still owns. A newer edit to the
 * same cell, saved or pending, is never undone by an older failure.
 */
export type Cell<V> = {
  rowId: string;
  /** Property id, or a row field such as "title" or "@rank". */
  field: string;
  /** Value before this write; undefined means "not set". */
  prev: V | undefined;
  /** Value this write set; undefined means "cleared". */
  next: V | undefined;
};

export const cellKey = (rowId: string, field: string) => `${rowId}:${field}`;

const same = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

export function createWriteLog() {
  let seq = 0;
  const latest = new Map<string, number>();
  return {
    /** Records a write to these cells and returns its sequence number. */
    begin(cells: { rowId: string; field: string }[]) {
      seq += 1;
      for (const c of cells) latest.set(cellKey(c.rowId, c.field), seq);
      return seq;
    },
    /**
     * The cells a failed write should restore: those no newer write touched
     * and whose current value is still the one this write set.
     */
    rollback<V>(
      seq: number,
      cells: Cell<V>[],
      current: (rowId: string, field: string) => V | undefined,
    ) {
      return cells.filter(
        (c) =>
          latest.get(cellKey(c.rowId, c.field)) === seq &&
          same(current(c.rowId, c.field), c.next),
      );
    },
  };
}
