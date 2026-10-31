import { describe, expect, it } from "vitest";
import {
  bestRowIndex,
  matchActions,
  matchDestinations,
  scoreCommand,
} from "./palette-commands";

describe("bestRowIndex", () => {
  const newNote = "New note";

  it("keeps New note for an empty query or when nothing else is listed", () => {
    expect(bestRowIndex("", [newNote, "Recent note"])).toBe(0);
    expect(bestRowIndex("gate", [newNote])).toBe(0);
  });

  it("picks the first result, an exact title first", () => {
    expect(bestRowIndex("gate", [newNote, "Fix the gate"])).toBe(1);
    expect(bestRowIndex("tasks", [newNote, "Tasks board", "tasks"])).toBe(2);
  });

  it("passes over a keyword-only row for a label match", () => {
    expect(bestRowIndex("ai", [newNote, "Open chat", "AI ideas"])).toBe(2);
  });
});

describe("scoreCommand", () => {
  it("ranks label prefix above word prefix above keyword", () => {
    expect(scoreCommand("ta", "Tasks", "todo")).toBe(3);
    expect(scoreCommand("bl", "Time Blocks", "calendar")).toBe(2);
    expect(scoreCommand("cal", "Time Blocks", "calendar schedule")).toBe(1);
    expect(scoreCommand("zzz", "Tasks", "todo")).toBe(0);
    expect(scoreCommand("  ", "Tasks")).toBe(0);
  });
});

const destinations = [
  { label: "Notes", href: "/", keywords: "docs home" },
  { label: "Time Blocks", href: "/time-blocks", keywords: "calendar schedule" },
  { label: "Tasks", href: "/tasks", keywords: "todo" },
];

describe("matchDestinations", () => {
  it("finds sections by name and keyword", () => {
    expect(matchDestinations("tas", destinations).map((d) => d.href)).toEqual(["/tasks"]);
    expect(matchDestinations("calendar", destinations).map((d) => d.href)).toEqual([
      "/time-blocks",
    ]);
  });

  it("returns nothing for an empty query", () => {
    expect(matchDestinations("", destinations)).toEqual([]);
  });
});

describe("matchActions", () => {
  it("filters shell actions", () => {
    const noop = () => undefined;
    const icon = () => null;
    const actions = [
      { key: "chat", label: "Open chat", keywords: "ai assistant", icon, run: noop },
      { key: "sidebar", label: "Toggle sidebar", icon, run: noop },
    ];
    expect(matchActions("ai", actions).map((a) => a.key)).toEqual(["chat"]);
    expect(matchActions("side", actions).map((a) => a.key)).toEqual(["sidebar"]);
  });
});
