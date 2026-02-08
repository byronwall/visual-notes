export type PathCount = { path: string; count: number };

export type PathDraft = {
  committed: string[];
  current: string;
};

export const parsePathDraft = (raw?: string): PathDraft => {
  const incoming = (raw || "").trim();
  if (!incoming) return { committed: [], current: "" };

  const tokens = incoming.split(".").filter((token) => token.length > 0);
  if (tokens.length <= 1) return { committed: [], current: tokens[0] || "" };

  return {
    committed: tokens.slice(0, -1),
    current: tokens[tokens.length - 1] || "",
  };
};

export const serializePathDraft = (draft: PathDraft) => {
  const parts = [...draft.committed];
  if (draft.current.length > 0) parts.push(draft.current);
  return parts.join(".");
};

export const commitCurrentSegment = (draft: PathDraft): PathDraft => {
  const nextCurrent = draft.current.trim();
  if (!nextCurrent) return draft;
  return { committed: [...draft.committed, nextCurrent], current: "" };
};

export const appendSegment = (draft: PathDraft, segment: string): PathDraft => ({
  committed: [...draft.committed, segment],
  current: "",
});

export const popSegmentIntoCurrent = (draft: PathDraft): PathDraft => {
  if (draft.current.length > 0) return draft;
  if (draft.committed.length === 0) return draft;
  const nextCommitted = draft.committed.slice(0, -1);
  const last = draft.committed[draft.committed.length - 1] || "";
  return { committed: nextCommitted, current: last };
};

export const truncatePathDraft = (draft: PathDraft, index: number): PathDraft => {
  if (index < 0 || index >= draft.committed.length) return draft;
  return { committed: draft.committed.slice(0, index + 1), current: "" };
};

export const setCurrentSegment = (draft: PathDraft, current: string): PathDraft => ({
  ...draft,
  current,
});

export const clearPathDraft = (): PathDraft => ({ committed: [], current: "" });

export const buildNextSegmentSuggestions = (
  items: PathCount[],
  committed: string[],
  current: string
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [] as { seg: string; count: number }[];
  }

  const typed = current.trim();
  const counts = new Map<string, number>();

  if (committed.length === 0) {
    for (const item of items) {
      const tokens = item.path.split(".");
      const segment = tokens[0] || "";
      if (!segment) continue;
      if (typed && !segment.startsWith(typed)) continue;
      counts.set(segment, (counts.get(segment) || 0) + item.count);
    }
  } else {
    const base = `${committed.join(".")}.`;
    for (const item of items) {
      if (!item.path.startsWith(base)) continue;
      const tokens = item.path.split(".");
      const segment = tokens[committed.length] || "";
      if (!segment) continue;
      if (typed && !segment.startsWith(typed)) continue;
      counts.set(segment, (counts.get(segment) || 0) + item.count);
    }
  }

  return Array.from(counts.entries())
    .map(([seg, count]) => ({ seg, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
};
