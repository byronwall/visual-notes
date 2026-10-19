import { normalizeDotPath } from "~/utils/path-links";
import type { PathNoteSort } from "../hooks/usePathViewParams";

export type PathNote = {
  id: string;
  title: string;
  path?: string | null;
  updatedAt: string;
};

export type PathNoteGroup = {
  /** Full path of the immediate child this group rolls up to ("" = the page path itself). */
  groupPath: string;
  notes: PathNote[];
};

/** The note's path relative to the page path, e.g. "design.v2" under "work.visual-notes". */
export const relativeNotePath = (notePath: string | null | undefined, basePath: string) => {
  const note = normalizeDotPath(notePath || "");
  const base = normalizeDotPath(basePath);
  if (!note || note === base) return "";
  if (!base) return note;
  return note.startsWith(`${base}.`) ? note.slice(base.length + 1) : note;
};

const titleCompare = (a: PathNote, b: PathNote) =>
  (a.title || "").localeCompare(b.title || "", undefined, {
    sensitivity: "base",
    numeric: true,
  }) || b.updatedAt.localeCompare(a.updatedAt);

export const sortPathNotes = (notes: PathNote[], sort: PathNoteSort) =>
  notes
    .slice()
    .sort(sort === "title" ? titleCompare : (a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const filterPathNotes = (
  notes: PathNote[],
  query: string,
  basePath: string,
) => {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (note) =>
      (note.title || "").toLowerCase().includes(q) ||
      relativeNotePath(note.path, basePath).toLowerCase().includes(q),
  );
};

/** Group notes by the immediate child path under the page path; notes filed here come first. */
export const groupPathNotes = (notes: PathNote[], basePath: string): PathNoteGroup[] => {
  const base = normalizeDotPath(basePath);
  const groups = new Map<string, PathNote[]>();
  for (const note of notes) {
    const head = relativeNotePath(note.path, base).split(".")[0] || "";
    const groupPath = head ? (base ? `${base}.${head}` : head) : "";
    const list = groups.get(groupPath);
    if (list) list.push(note);
    else groups.set(groupPath, [note]);
  }
  return Array.from(groups.entries())
    .map(([groupPath, groupNotes]) => ({ groupPath, notes: groupNotes }))
    .sort((a, b) => {
      if (!a.groupPath) return -1;
      if (!b.groupPath) return 1;
      return a.groupPath.localeCompare(b.groupPath);
    });
};
