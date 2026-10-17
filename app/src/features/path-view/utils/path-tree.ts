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

export const findPathNode = (
  root: PathTreeNode,
  path: string,
): PathTreeNode | undefined => {
  if (!path) return root;
  let node: PathTreeNode | undefined = root;
  for (const segment of path.split(".")) {
    node = node?.children.find((child) => child.segment === segment);
    if (!node) return undefined;
  }
  return node;
};

/** Keep nodes whose path matches the query, plus the ancestors leading to them. */
export const filterPathTree = (
  node: PathTreeNode,
  query: string,
): PathTreeNode | null => {
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
