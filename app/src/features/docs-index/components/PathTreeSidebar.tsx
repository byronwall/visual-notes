import {
  For,
  Suspense,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchPathSuggestions } from "~/services/docs.service";
import type { DocsQueryStore } from "../state/docsQuery";

type PathCount = { path: string; count: number };

type TreeNode = {
  key: string; // segment label for this level
  prefix: string; // full dot-joined prefix to this node
  count: number; // aggregated count of all descendants + exact
  exactCount: number; // count for an exact path match
  children: Map<string, TreeNode>;
};

function buildTree(items: PathCount[]): TreeNode {
  const root: TreeNode = {
    key: "",
    prefix: "",
    count: 0,
    exactCount: 0,
    children: new Map<string, TreeNode>(),
  };

  for (const { path, count } of items) {
    const tokens = path.split(".").filter((t) => t.length > 0);
    let cursor = root;
    let acc: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const seg = tokens[i];
      acc.push(seg);
      const prefix = acc.join(".");
      if (!cursor.children.has(seg)) {
        cursor.children.set(seg, {
          key: seg,
          prefix,
          count: 0,
          exactCount: 0,
          children: new Map<string, TreeNode>(),
        });
      }
      const next = cursor.children.get(seg)!;
      // Aggregate counts at each prefix level
      next.count += count;
      if (i === tokens.length - 1) {
        next.exactCount += count;
      }
      cursor = next;
    }
    root.count += count;
  }

  return root;
}

function sortChildren(node: TreeNode): void {
  if (node.children.size === 0) return;
  const sorted = [...node.children.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key)
  );
  node.children = new Map(sorted.map((n) => [n.key, n]));
  for (const child of node.children.values()) sortChildren(child);
}

export const PathTreeSidebar: VoidComponent<{ q: DocsQueryStore }> = (
  props
) => {
  const [pathCounts] = createResource(fetchPathSuggestions);
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});

  const tree = createMemo(() => {
    const items = (pathCounts() || []) as PathCount[];
    try {
      console.log(`[PathTreeSidebar] loaded ${items.length} paths`);
    } catch {}
    const t = buildTree(items);
    sortChildren(t);
    return t;
  });

  const isExpanded = (prefix: string) => {
    if (!prefix) return true; // root always expanded
    return !!expanded()[prefix];
  };

  const toggleExpanded = (prefix: string) => {
    setExpanded((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  const expandAll = () => {
    const t = tree();
    const out: Record<string, boolean> = {};
    const visit = (n: TreeNode) => {
      out[n.prefix] = true;
      for (const c of n.children.values()) visit(c);
    };
    visit(t);
    console.log(
      `[PathTreeSidebar] expand all: ${Object.keys(out).length} nodes`
    );
    setExpanded(out);
  };

  const handleSelectPrefix = (prefix: string) => {
    console.log(`[PathTreeSidebar] select prefix="${prefix}"`);
    props.q.setBlankPathOnly(false);
    props.q.setPathPrefix(prefix);
    props.q.resetPaging();
  };

  const NodeRow: VoidComponent<{ node: TreeNode; depth: number }> = (p) => {
    const hasChildren = createMemo(() => p.node.children.size > 0);
    const paddingLeft = createMemo(() => `${p.depth * 12}px`);
    const handleToggle = () => toggleExpanded(p.node.prefix);
    const handleClick = () => handleSelectPrefix(p.node.prefix);

    return (
      <div class="px-2">
        <div
          class="flex items-center gap-1 py-1 hover:bg-gray-50 rounded cursor-pointer"
          style={{ "padding-left": paddingLeft() }}
        >
          <button
            class={`w-5 h-5 flex items-center justify-center text-gray-500 ${
              hasChildren() ? "" : "opacity-30 pointer-events-none"
            }`}
            onClick={handleToggle}
            aria-label={isExpanded(p.node.prefix) ? "Collapse" : "Expand"}
          >
            {isExpanded(p.node.prefix) ? "▾" : "▸"}
          </button>
          <button
            class="flex-1 text-left text-sm truncate"
            onClick={handleClick}
            title={p.node.prefix || "(root)"}
          >
            {p.node.key || "(root)"}
          </button>
          <span class="text-xs text-gray-600 tabular-nums">{p.node.count}</span>
        </div>
        {hasChildren() && isExpanded(p.node.prefix) && (
          <div>
            <For each={[...p.node.children.values()]}>
              {(child) => <NodeRow node={child} depth={p.depth + 1} />}
            </For>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside class="fixed left-0 top-14 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-20">
      <div class="p-2 border-b border-gray-200">
        <div class="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Paths
        </div>
        <div class="mt-2 flex items-center gap-2">
          <button
            class="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
            onClick={() => {
              console.log("[PathTreeSidebar] clear prefix");
              props.q.setPathPrefix("");
              props.q.setBlankPathOnly(false);
              props.q.resetPaging();
            }}
          >
            Clear
          </button>
          <div class="ml-auto flex items-center gap-2">
            <button
              class="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              onClick={expandAll}
            >
              Expand all
            </button>
            <button
              class="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              onClick={() => setExpanded({})}
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>
      <Suspense
        fallback={<div class="p-2 text-sm text-gray-500">Loading paths…</div>}
      >
        <div class="py-2">
          <NodeRow node={tree()} depth={0} />
        </div>
      </Suspense>
    </aside>
  );
};

export default PathTreeSidebar;
