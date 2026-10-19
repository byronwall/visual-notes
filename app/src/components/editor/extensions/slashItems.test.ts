import { describe, expect, it } from "vitest";
import { SLASH_ITEMS, filterSlashItems } from "./slashItems";

const titles = (query: string) =>
  filterSlashItems(SLASH_ITEMS, query).map((item) => item.title);

describe("filterSlashItems", () => {
  it("returns every block for an empty query", () => {
    expect(titles("")).toHaveLength(SLASH_ITEMS.length);
  });

  it("ranks title prefixes first", () => {
    expect(titles("he")).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
  });

  it("matches later words and keywords", () => {
    expect(titles("list")[0]).toBe("Bulleted list");
    expect(titles("hr")).toEqual(["Divider"]);
    expect(titles("ul")).toEqual(["Bulleted list"]);
  });

  it("returns nothing for unrelated text", () => {
    expect(titles("zzz")).toEqual([]);
  });
});
