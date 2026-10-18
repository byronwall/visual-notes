import type { PathStat } from "~/services/docs.service";

export type PathTreeNode = {
  segment: string;
  path: string;
  depth: number;
  /** Notes filed exactly at this path. */
  ownCount: number;
  /** Notes at this path plus every descendant path. */
  totalCount: number;
  /** Newest update anywhere in this subtree (ISO string). */
  lastUpdatedAt: string | null;
  children: PathTreeNode[];
};

const newerIso = (a: string | null, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
};

export const buildPathTree = (stats: PathStat[]): PathTreeNode => {
  const root: PathTreeNode = {
    segment: "",
    path: "",
    depth: 0,
    ownCount: 0,
    totalCount: 0,
    lastUpdatedAt: null,
    children: [],
  };
  const byPath = new Map<string, PathTreeNode>([["", root]]);

  for (const stat of stats) {
    const segments = stat.path
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length === 0) continue;
    let parent = root;
    root.totalCount += stat.count;
    root.lastUpdatedAt = newerIso(root.lastUpdatedAt, stat.lastUpdatedAt);
    for (let i = 0; i < segments.length; i += 1) {
      const path = segments.slice(0, i + 1).join(".");
      let node = byPath.get(path);
      if (!node) {
        node = {
          segment: segments[i],
          path,
          depth: i + 1,
          ownCount: 0,
          totalCount: 0,
          lastUpdatedAt: null,
          children: [],
        };
        byPath.set(path, node);
        parent.children.push(node);
      }
      node.totalCount += stat.count;
      node.lastUpdatedAt = newerIso(node.lastUpdatedAt, stat.lastUpdatedAt);
      if (i === segments.length - 1) node.ownCount += stat.count;
      parent = node;
    }
  }

  const sortChildren = (node: PathTreeNode) => {
    node.children.sort((a, b) =>
      a.segment.localeCompare(b.segment, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
    node.children.forEach(sortChildren);
  };
  sortChildren(root);
  return root;
};

export const findPathNode = (root: PathTreeNode, path: string): PathTreeNode | undefined => {
  if (!path) return root;
  let node: PathTreeNode | undefined = root;
  for (const segment of path.split(".")) {
    node = node?.children.find((child) => child.segment === segment);
    if (!node) return undefined;
  }
  return node;
};

/** Keep nodes whose path matches the query, plus the ancestors leading to them. */
export const filterPathTree = (node: PathTreeNode, query: string): PathTreeNode | null => {
  const q = query.trim().toLowerCase();
  if (!q) return node;
  const children = node.children
    .map((child) => filterPathTree(child, q))
    .filter((child): child is PathTreeNode => child !== null);
  if (children.length > 0 || node.path.toLowerCase().includes(q)) {
    return { ...node, children };
  }
  return null;
};

/** The first path (tree order) whose full path contains the query, preferring segment matches. */
export const firstPathMatch = (root: PathTreeNode, query: string): string | null => {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let fallback: string | null = null;
  const visit = (node: PathTreeNode): string | null => {
    for (const child of node.children) {
      if (child.segment.toLowerCase().includes(q)) return child.path;
      if (!fallback && child.path.toLowerCase().includes(q)) fallback = child.path;
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(root) ?? fallback;
};

export type VisiblePathItem = {
  path: string;
  segment: string;
  depth: number;
  parentPath: string;
  hasChildren: boolean;
};

/** Tree rows in on-screen order, skipping the children of collapsed nodes. */
export const flattenVisiblePaths = (
  root: PathTreeNode,
  isExpanded: (path: string) => boolean,
): VisiblePathItem[] => {
  const items: VisiblePathItem[] = [];
  const visit = (node: PathTreeNode) => {
    for (const child of node.children) {
      const hasChildren = child.children.length > 0;
      items.push({
        path: child.path,
        segment: child.segment,
        depth: child.depth,
        parentPath: node.path,
        hasChildren,
      });
      if (hasChildren && isExpanded(child.path)) visit(child);
    }
  };
  visit(root);
  return items;
};

/**
 * Typeahead target: the next row (after `fromIndex`, wrapping) whose segment
 * starts with `prefix`. A repeated single letter ("ccc") cycles through rows
 * starting with that letter, like a native select.
 */
export const typeaheadMatch = (
  items: VisiblePathItem[],
  fromIndex: number,
  prefix: string,
): number => {
  const q = prefix.toLowerCase();
  if (!q || items.length === 0) return -1;
  const repeated = q.length > 1 && [...q].every((ch) => ch === q[0]);
  const needle = repeated ? q[0] : q;
  // A fresh multi-letter prefix may still match the current row.
  const start = needle.length > 1 ? fromIndex : fromIndex + 1;
  for (let i = 0; i < items.length; i += 1) {
    const index = (start + i + items.length) % items.length;
    if (items[index].segment.toLowerCase().startsWith(needle)) return index;
  }
  return -1;
};
