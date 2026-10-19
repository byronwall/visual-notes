import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { PathTreeNode } from "../utils/path-tree";
import { flattenVisiblePaths, typeaheadMatch } from "../utils/path-tree";

const TYPEAHEAD_RESET_MS = 600;
const TYPEAHEAD_KEY = /^[\p{L}\p{N}_-]$/u;

// Set when a keyboard Enter navigates, so the rail that mounts on the next
// route (index -> detail remounts the shell) picks focus back up.
let restoreFocusAfterNavigate = false;

const parentOf = (path: string) => path.split(".").slice(0, -1).join(".");

/**
 * Roving focus for the path tree (WAI-ARIA tree pattern): one row is
 * tabbable, arrows/Home/End move, Left/Right collapse/expand, Enter opens,
 * printable keys jump by typeahead. Focus follows the current path.
 */
export const usePathTreeFocus = (opts: {
  tree: () => PathTreeNode | null;
  activePath: () => string;
  isExpanded: (path: string) => boolean;
  setExpanded: (path: string, expanded: boolean) => void;
  /** While filtering every branch is forced open, so Left skips collapsing. */
  filtering: () => boolean;
  open: (path: string, newTab: boolean) => void;
}) => {
  let treeEl: HTMLElement | undefined;
  const [focusedPath, setFocusedPath] = createSignal(opts.activePath());
  let typeahead = "";
  let typeaheadTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(typeaheadTimer));

  const items = createMemo(() => {
    const tree = opts.tree();
    return tree ? flattenVisiblePaths(tree, opts.isExpanded) : [];
  });

  /** The single row in the tab order: the focused row, or its nearest visible ancestor. */
  const tabbablePath = createMemo(() => {
    const list = items();
    const visible = new Set(list.map((item) => item.path));
    for (let path = focusedPath(); path; path = parentOf(path)) {
      if (visible.has(path)) return path;
    }
    if (visible.has(opts.activePath())) return opts.activePath();
    return list[0]?.path ?? "";
  });

  const rowFor = (path: string) =>
    treeEl?.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(path)}"]`) ?? null;

  const focusPath = (path: string) => {
    setFocusedPath(path);
    queueMicrotask(() => rowFor(path)?.focus());
  };

  const focusFirst = () => {
    const first = items()[0];
    if (first) focusPath(first.path);
  };

  // Keep the roving row on the current path. Real focus follows only when the
  // tree held it as the path changed, or a keyboard Enter just navigated here.
  let lastActive: string | undefined;
  createEffect(
    on([opts.activePath, items], ([active]) => {
      const pathChanged = active !== lastActive;
      lastActive = active;
      if (pathChanged) setFocusedPath(active);
      const treeHadFocus = pathChanged && !!treeEl?.contains(document.activeElement);
      if (!treeHadFocus && !restoreFocusAfterNavigate) return;
      const row = rowFor(active);
      // Skip the copy of the rail that is hidden at this width.
      if (!row || row.offsetParent === null) return;
      row.focus({ preventScroll: true });
      restoreFocusAfterNavigate = false;
    }),
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey) return;
    const list = items();
    const index = list.findIndex((item) => item.path === tabbablePath());
    const item = list[index];
    if (!item) return;
    const move = (to: number) => {
      const target = list[Math.max(0, Math.min(list.length - 1, to))];
      if (target) focusPath(target.path);
    };

    switch (event.key) {
      case "ArrowDown":
        move(index + 1);
        break;
      case "ArrowUp":
        move(index - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(list.length - 1);
        break;
      case "ArrowRight":
        if (!item.hasChildren) break;
        if (opts.isExpanded(item.path)) move(index + 1);
        else opts.setExpanded(item.path, true);
        break;
      case "ArrowLeft":
        if (item.hasChildren && opts.isExpanded(item.path) && !opts.filtering()) {
          opts.setExpanded(item.path, false);
        } else if (item.parentPath) {
          focusPath(item.parentPath);
        }
        break;
      case "Enter":
        if (!event.metaKey) {
          restoreFocusAfterNavigate = true;
          setTimeout(() => (restoreFocusAfterNavigate = false), 3000);
        }
        opts.open(item.path, event.metaKey);
        break;
      default: {
        if (event.metaKey || !TYPEAHEAD_KEY.test(event.key)) return;
        clearTimeout(typeaheadTimer);
        typeahead += event.key;
        typeaheadTimer = setTimeout(() => (typeahead = ""), TYPEAHEAD_RESET_MS);
        const match = typeaheadMatch(list, index, typeahead);
        if (match >= 0) move(match);
      }
    }
    event.preventDefault();
  };

  const onFocusIn = (event: FocusEvent) => {
    const row = (event.target as Element | null)?.closest<HTMLElement>("[data-tree-path]");
    if (row?.dataset.treePath) setFocusedPath(row.dataset.treePath);
  };

  return {
    setTreeRef: (el: HTMLElement) => (treeEl = el),
    tabbablePath,
    focusFirst,
    onKeyDown,
    onFocusIn,
  };
};
