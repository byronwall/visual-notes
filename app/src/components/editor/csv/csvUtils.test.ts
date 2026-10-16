import { describe, expect, it } from "vitest";
import { csvTextToTableJson, isProbablyCSV } from "./csvUtils";

describe("CSV and TSV detection", () => {
  it("does not classify ordinary five-line prose as delimited text", () => {
    expect(
      isProbablyCSV(
        "This is one sentence\nThis is another sentence\nHere is a third thought\nA fourth line follows\nAnd a fifth line ends",
      ),
    ).toBe(false);
  });

  it("detects consistent multi-column CSV and TSV", () => {
    expect(
      isProbablyCSV("name,age\nAda,36\nGrace,85\nLinus,55\nMargaret,88"),
    ).toBe(true);
    expect(
      isProbablyCSV("name\tage\nAda\t36\nGrace\t85\nLinus\t55\nMargaret\t88"),
    ).toBe(true);
  });

  it("does not treat quoted delimiters in one-column rows as column evidence", () => {
    expect(
      isProbablyCSV(
        '"first, item"\n"second, item"\n"third, item"\n"fourth, item"\n"fifth, item"',
      ),
    ).toBe(false);
    expect(
      isProbablyCSV(
        '"first\titem"\n"second\titem"\n"third\titem"\n"fourth\titem"\n"fifth\titem"',
      ),
    ).toBe(false);
  });

  it("keeps one-column text convertible for explicit file imports", () => {
    const table = csvTextToTableJson("one\ntwo\nthree\nfour\nfive");
    expect(isProbablyCSV("one\ntwo\nthree\nfour\nfive")).toBe(false);
    expect(table.content?.map((row) => row.content?.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });
});
