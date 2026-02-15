import { createMemo, createSignal } from "solid-js";
import { normalizeDotPath } from "~/utils/path-links";

export type PathGroupNote = {
  id: string;
  title: string;
  path?: string | null;
  updatedAt: string;
};

export type PathGroupSection = {
  groupPath: string;
  notes: PathGroupNote[];
};

export const usePathGroups = (args: {
  path: () => string;
  notes: () => PathGroupNote[];
}) => {
  const [expandedGroups, setExpandedGroups] = createSignal<Record<string, boolean>>(
    {},
  );

  const grouped = createMemo<PathGroupSection[]>(() => {
    const base = normalizeDotPath(args.path());
    const groups = new Map<string, PathGroupSection>();
    for (const note of args.notes()) {
      const notePath = normalizeDotPath(note.path || "");
      const remainder = notePath.startsWith(`${base}.`)
        ? notePath.slice(base.length + 1)
        : "";
      const nextSeg = remainder.split(".")[0] || "";
      const groupPath = nextSeg ? `${base}.${nextSeg}` : base;
      const existing = groups.get(groupPath);
      if (existing) existing.notes.push(note);
      else groups.set(groupPath, { groupPath, notes: [note] });
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.groupPath === base) return -1;
      if (b.groupPath === base) return 1;
      return a.groupPath.localeCompare(b.groupPath);
    });

    return sortedGroups.map((group) => ({
      ...group,
      notes: group.notes
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  });

  const hasMultipleGroups = createMemo(() => grouped().length > 1);
  const isGroupExpanded = (groupPath: string) => !!expandedGroups()[groupPath];
  const visibleNotesForGroup = (group: PathGroupSection) => {
    if (!hasMultipleGroups()) return group.notes;
    if (isGroupExpanded(group.groupPath)) return group.notes;
    return group.notes.slice(0, 10);
  };
  const canExpandGroup = (group: PathGroupSection) =>
    hasMultipleGroups() && group.notes.length > 10;
  const toggleGroupExpanded = (groupPath: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupPath]: !prev[groupPath],
    }));
  };

  const visibleNoteIds = createMemo(() => {
    const ids: string[] = [];
    for (const group of grouped()) {
      for (const note of visibleNotesForGroup(group)) ids.push(note.id);
    }
    return ids;
  });

  return {
    grouped,
    visibleNoteIds,
    visibleNotesForGroup,
    canExpandGroup,
    isGroupExpanded,
    toggleGroupExpanded,
  };
};
