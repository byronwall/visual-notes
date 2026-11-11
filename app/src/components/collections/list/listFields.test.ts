import { describe, expect, it } from "vitest";
import type {
  CollectionProperty,
  PropertyKind,
} from "~/lib/collections/types";
import { listFields } from "./listFields";

const prop = (id: string, kind: PropertyKind, position: number) =>
  ({ id, name: id, kind, config: {}, position }) as CollectionProperty;

const props = [
  prop("notes", "text", 0),
  prop("stage", "status", 1),
  prop("created", "created_time", 2),
  prop("tags", "multi_select", 3),
  prop("year", "number", 4),
  prop("due", "date", 5),
];

describe("listFields", () => {
  it("picks short-reading properties and keeps view order", () => {
    const ids = listFields(props, {}).map((p) => p.id);
    expect(ids).toEqual(["stage", "year", "due"]);
  });

  it("skips hidden properties", () => {
    const ids = listFields(props, { hiddenProperties: ["year"] }).map(
      (p) => p.id,
    );
    expect(ids).toEqual(["stage", "tags", "due"]);
  });

  it("uses the view's card properties, hidden or not", () => {
    const ids = listFields(props, {
      cardProperties: ["notes", "created"],
      hiddenProperties: ["notes"],
    }).map((p) => p.id);
    expect(ids).toEqual(["notes", "created"]);
  });
});
