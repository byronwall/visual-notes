import { A, useNavigate } from "@solidjs/router";
import { SearchIcon, XIcon } from "lucide-solid";
import { For, Show, createEffect, createMemo, createSelector, createSignal, on } from "solid-js";
import { css } from "styled-system/css";
import { buildPathAncestors } from "~/utils/path-links";
import type { PathTreeNode } from "../utils/path-tree";
import { filterPathTree, firstPathMatch } from "../utils/path-tree";
import { pathToRoute } from "~/utils/path-links";
import { usePathTreeFocus } from "../hooks/usePathTreeFocus";
import { PathTreeRailNode } from "./PathTreeRailNode";

// Manual expand/collapse choices survive navigation between path pages.
const [manualExpanded, setManualExpanded] = createSignal<Record<string, boolean>>({});

const railClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  minH: "0",
});

const rootLinkClass = css({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "2",
  px: "2",
  py: "1",
  borderRadius: "l2",
  fontSize: "sm",
  fontWeight: "semibold",
  color: "fg.default",
  textDecoration: "none",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.muted" },
  "&[aria-current=page]": { bg: "bg.selected", color: "fg.selected" },
});

const filterWrapClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  color: "fg.subtle",
});

const filterInputClass = css({
  w: "full",
  h: "8",
  pl: "7",
  pr: "2",
  borderRadius: "l2",
  bg: "bg.muted",
  fontSize: "sm",
  color: "fg.default",
  outline: "none",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "fast",
  _placeholder: { color: "fg.subtle" },
  _focusVisible: {
    bg: "bg.default",
    boxShadow: "0 0 0 1px token(colors.gray.7)",
  },
  "&::-webkit-search-cancel-button": { display: "none" },
});

const clearButtonClass = css({
  position: "absolute",
  right: "1",
  display: "inline-flex",
  p: "1",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { color: "fg.default", bg: "bg.hover" },
});

export const PathTreeRail = (props: {
  tree: PathTreeNode;
  activePath: string;
  onNavigate?: () => void;
  ref?: (el: HTMLElement) => void;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");

  const autoExpanded = createMemo(() => new Set(buildPathAncestors(props.activePath)));
  const filtered = createMemo(() => filterPathTree(props.tree, query()));
  // Render the original nodes (filtered by path) so <For> keeps existing rows
  // while typing instead of rebuilding the whole tree on every keystroke.
  const visiblePaths = createMemo(() => {
    const root = filtered();
    if (!query().trim() || !root) return null;
    const paths = new Set<string>();
    const visit = (node: PathTreeNode) =>
      node.children.forEach((child) => (paths.add(child.path), visit(child)));
    visit(root);
    return paths;
  });
  const childrenOf = (node: PathTreeNode) => {
    const visible = visiblePaths();
    return visible ? node.children.filter((child) => visible.has(child.path)) : node.children;
  };

  const isExpanded = (path: string) => {
    if (query().trim()) return true;
    const manual = manualExpanded()[path];
    if (manual !== undefined) return manual;
    return autoExpanded().has(path);
  };
  const setExpanded = (path: string, expanded: boolean) =>
    setManualExpanded((prev) => ({ ...prev, [path]: expanded }));
  const toggle = (path: string) => setExpanded(path, !isExpanded(path));

  const openPath = (path: string, newTab: boolean) => {
    if (newTab) {
      window.open(pathToRoute(path), "_blank", "noopener");
      return;
    }
    setQuery("");
    props.onNavigate?.();
    navigate(pathToRoute(path));
  };

  const focus = usePathTreeFocus({
    tree: filtered,
    activePath: () => props.activePath,
    isExpanded,
    setExpanded,
    filtering: () => !!query().trim(),
    open: openPath,
  });

  let navEl: HTMLElement | undefined;
  // Keep the current path visible in long trees after each navigation.
  createEffect(
    on(
      () => props.activePath,
      () =>
        requestAnimationFrame(() =>
          navEl
            ?.querySelector("[aria-current=page] > [data-row], a[aria-current=page]")
            ?.scrollIntoView({ block: "nearest" }),
        ),
    ),
  );

  const isTabbable = createSelector(focus.tabbablePath);

  return (
    <nav
      ref={(el) => {
        navEl = el;
        props.ref?.(el);
      }}
      class={railClass}
      aria-label="Path tree"
    >
      <A
        href="/path"
        class={rootLinkClass}
        aria-current={props.activePath ? undefined : "page"}
        onClick={() => props.onNavigate?.()}
      >
        <span>All paths</span>
        <span
          class={css({
            fontSize: "xs",
            fontWeight: "normal",
            color: "fg.subtle",
          })}
        >
          {props.tree.totalCount}
        </span>
      </A>
      <label class={filterWrapClass}>
        <SearchIcon size={14} class={css({ position: "absolute", left: "2" })} />
        <input
          class={filterInputClass}
          type="search"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query()) {
              event.stopPropagation();
              setQuery("");
            }
            if (event.key === "Enter") {
              const match = firstPathMatch(props.tree, query());
              if (!match) return;
              event.preventDefault();
              openPath(match, false);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focus.focusFirst();
            }
          }}
          placeholder="Find a path"
          aria-label="Find a path"
        />
        <Show when={query()}>
          <button
            type="button"
            class={clearButtonClass}
            aria-label="Clear path search"
            onClick={() => setQuery("")}
          >
            <XIcon size={12} />
          </button>
        </Show>
      </label>
      <Show
        when={filtered()?.children.length}
        fallback={
          <p class={css({ px: "2", fontSize: "sm", color: "fg.subtle" })}>
            {query().trim() ? `No paths match “${query().trim()}”.` : "No paths yet."}
          </p>
        }
      >
        <ul
          ref={focus.setTreeRef}
          role="tree"
          aria-label="Paths"
          class={css({ listStyle: "none" })}
          onKeyDown={focus.onKeyDown}
          onFocusIn={focus.onFocusIn}
        >
          <For each={childrenOf(props.tree)}>
            {(node) => (
              <PathTreeRailNode
                node={node}
                activePath={props.activePath}
                isTabbable={isTabbable}
                childrenOf={childrenOf}
                query={query().trim()}
                isExpanded={isExpanded}
                onToggle={toggle}
                onNavigate={props.onNavigate}
              />
            )}
          </For>
        </ul>
      </Show>
    </nav>
  );
};
