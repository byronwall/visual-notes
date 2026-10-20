import { describe, expect, it } from "vitest";
import {
  mapBetweenCollections,
  mapMetaToProperties,
  resolveNewOptions,
} from "./mapping";
import type { CollectionProperty } from "./types";

const reading: CollectionProperty[] = [
  {
    id: "st",
    name: "Status",
    kind: "status",
    position: 0,
    config: {
      options: [
        { id: "o-read", name: "Reading", color: "blue", group: "doing" },
      ],
    },
  },
  { id: "pg", name: "Pages", kind: "number", position: 1, config: {} },
  {
    id: "tg",
    name: "Tags",
    kind: "multi_select",
    position: 2,
    config: { options: [{ id: "o-ml", name: "ML", color: "red" }] },
  },
  { id: "ct", name: "Created", kind: "created_time", position: 3, config: {} },
];

describe("mapMetaToProperties", () => {
  it("matches keys case-insensitively and parses values", () => {
    const mapped = mapMetaToProperties(
      { status: "reading", PAGES: "320", tags: "ML, Systems", source: "x" },
      reading,
    );
    expect(mapped.values).toEqual({ st: "o-read", pg: 320, tg: ["o-ml"] });
    expect(mapped.newOptions).toEqual({ tg: ["Systems"] });
    expect(mapped.carried).toEqual(["Status", "Pages", "Tags"]);
    expect(mapped.dropped).toEqual(["source"]);
  });

  it("drops values that cannot be parsed and ignores computed properties", () => {
    const mapped = mapMetaToProperties(
      { pages: "lots", created: "2026-01-01" },
      reading,
    );
    expect(mapped.values).toEqual({});
    expect(mapped.dropped).toEqual(["pages", "created"]);
  });
});

describe("mapBetweenCollections", () => {
  const research: CollectionProperty[] = [
    {
      id: "stage",
      name: "status",
      kind: "select",
      position: 0,
      config: { options: [{ id: "x-read", name: "Reading", color: "gray" }] },
    },
    { id: "pages", name: "Pages", kind: "text", position: 1, config: {} },
    {
      id: "topics",
      name: "Tags",
      kind: "multi_select",
      position: 2,
      config: { options: [] },
    },
  ];

  it("carries values by name, maps options by name, and reports drops", () => {
    const mapped = mapBetweenCollections(reading, research, {
      st: "o-read",
      pg: 320,
      tg: ["o-ml"],
    });
    expect(mapped.values).toEqual({ stage: "x-read", pages: "320" });
    expect(mapped.newOptions).toEqual({ topics: ["ML"] });
    expect(mapped.dropped).toEqual([]);
  });

  it("drops fields with no matching property", () => {
    const mapped = mapBetweenCollections(reading, [research[1]!], {
      st: "o-read",
      pg: 10,
    });
    expect(mapped.dropped).toEqual(["Status"]);
  });
});

describe("resolveNewOptions", () => {
  it("fills ids for options created after mapping", () => {
    const withOption: CollectionProperty[] = [
      {
        ...reading[2]!,
        config: {
          options: [
            ...reading[2]!.config.options!,
            { id: "o-sys", name: "Systems", color: "blue" },
          ],
        },
      },
    ];
    expect(
      resolveNewOptions(
        {
          values: { tg: ["o-ml"] },
          newOptions: { tg: ["Systems"] },
          carried: [],
          dropped: [],
        },
        withOption,
      ),
    ).toEqual({
      tg: ["o-ml", "o-sys"],
    });
  });
});
