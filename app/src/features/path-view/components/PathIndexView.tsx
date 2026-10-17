import { createAsync } from "@solidjs/router";
import { Show, createMemo } from "solid-js";
import { css } from "styled-system/css";
import { fetchPathDiscovery } from "~/services/docs.service";
import { usePathTree } from "../hooks/usePathTree";
import type { PathTreeNode } from "../utils/path-tree";
import { PathBrowserShell } from "./PathBrowserShell";
import { PathRecentList, type PathRecentItem } from "./PathRecentList";
import { PathSubpathGrid } from "./PathSubpathGrid";

const RECENT_LIMIT = 6;

const collectLeaves = (node: PathTreeNode, out: PathTreeNode[] = []) => {
  for (const child of node.children) {
    if (child.ownCount > 0) out.push(child);
    collectLeaves(child, out);
  }
  return out;
};

export const PathIndexView = () => {
  const tree = usePathTree();
  const discovery = createAsync(() => fetchPathDiscovery());

  const pathCount = createMemo(() => collectLeaves(tree()).length);
  const recentlyUpdated = createMemo<PathRecentItem[]>(() =>
    collectLeaves(tree())
      .filter((node) => node.lastUpdatedAt)
      .sort((a, b) => (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? ""))
      .slice(0, RECENT_LIMIT)
      .map((node) => ({ path: node.path, count: node.ownCount, at: node.lastUpdatedAt })),
  );
  const recentlyViewed = createMemo<PathRecentItem[]>(() =>
    (discovery()?.recentlyViewed ?? []).slice(0, RECENT_LIMIT).map((item) => ({
      path: item.path,
      count: item.count,
      at: item.lastViewedAt ?? null,
    })),
  );

  return (
    <PathBrowserShell tree={tree()} activePath="">
      <div class={css({ display: "flex", flexDirection: "column", gap: "7" })}>
        <header>
          <h1 class={css({ fontSize: { base: "xl", md: "2xl" }, fontWeight: "semibold", lineHeight: "1.25" })}>
            Paths
          </h1>
          <p class={css({ mt: "1", fontSize: "sm", color: "fg.muted", fontVariantNumeric: "tabular-nums" })}>
            {tree().totalCount} notes across {pathCount()} paths
          </p>
        </header>

        <Show when={recentlyUpdated().length > 0 || recentlyViewed().length > 0}>
          <div
            class={css({
              display: "grid",
              gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" },
              gap: { base: "5", lg: "10" },
            })}
          >
            <Show when={recentlyUpdated().length > 0}>
              <PathRecentList title="Recently updated" items={recentlyUpdated()} verb="Updated" />
            </Show>
            <Show when={recentlyViewed().length > 0}>
              <PathRecentList title="Recently viewed" items={recentlyViewed()} verb="Viewed" />
            </Show>
          </div>
        </Show>

        <section>
          <h2 class={css({ mb: "2", fontSize: "sm", fontWeight: "semibold", color: "fg.muted" })}>
            All areas
          </h2>
          <Show
            when={tree().children.length > 0}
            fallback={
              <p class={css({ py: "6", fontSize: "sm", color: "fg.muted" })}>
                No notes have a path yet. Set one from a note's properties to start organizing.
              </p>
            }
          >
            <PathSubpathGrid nodes={tree().children} />
          </Show>
        </section>
      </div>
    </PathBrowserShell>
  );
};
