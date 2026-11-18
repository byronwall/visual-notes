import { describe, expect, it } from "vitest";
import { type Cell, createWriteLog } from "./optimistic";

describe("createWriteLog rollback", () => {
  it("keeps a newer edit when an older write to the same cell fails", () => {
    const log = createWriteLog();
    const values: Record<string, number | undefined> = { rating: 1 };
    const current = (_row: string, field: string) => values[field];

    const a: Cell<number>[] = [{ rowId: "r", field: "rating", prev: 1, next: 3 }];
    const seqA = log.begin(a);
    values.rating = 3;
    const b: Cell<number>[] = [{ rowId: "r", field: "rating", prev: 3, next: 5 }];
    log.begin(b);
    values.rating = 5;

    expect(log.rollback(seqA, a, current)).toEqual([]);
  });

  it("undoes only the failed write's own cells", () => {
    const log = createWriteLog();
    const values: Record<string, string | undefined> = {
      status: "todo",
      owner: "ann",
    };
    const current = (_row: string, field: string) => values[field];

    const a: Cell<string>[] = [
      { rowId: "r", field: "status", prev: "todo", next: "done" },
      { rowId: "r", field: "owner", prev: "ann", next: "bob" },
    ];
    const seqA = log.begin(a);
    values.status = "done";
    values.owner = "bob";
    // A newer edit to owner saves while A is in flight.
    log.begin([{ rowId: "r", field: "owner" }]);
    values.owner = "cy";

    expect(log.rollback(seqA, a, current)).toEqual([a[0]]);
  });

  it("skips a cell whose value changed outside the log", () => {
    const log = createWriteLog();
    let value: string | undefined = "x";
    const a: Cell<string>[] = [{ rowId: "r", field: "f", prev: undefined, next: "x" }];
    const seq = log.begin(a);
    value = "from-server";
    expect(log.rollback(seq, a, () => value)).toEqual([]);
  });
});
