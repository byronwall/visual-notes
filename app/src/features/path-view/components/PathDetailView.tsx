import { createAsync } from "@solidjs/router";
import { Show, Suspense, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { fetchPathPageData } from "~/services/docs.service";
import { usePathTree } from "../hooks/usePathTree";
import { findPathNode } from "../utils/path-tree";
import { PathBrowserShell } from "./PathBrowserShell";
import { PathHeader } from "./PathHeader";
import { PathNoteList } from "./PathNoteList";
import { PathNoteListSkeleton } from "./PathNoteListSkeleton";
import { PathQuickCreate } from "./PathQuickCreate";
import { PathSubpathGrid } from "./PathSubpathGrid";

const sectionTitleClass = css({
  mb: "2",
  fontSize: "sm",
  fontWeight: "semibold",
  color: "fg.muted",
});

export const PathDetailView = (props: { path: string }) => {
  const tree = usePathTree();
  const data = createAsync(() => fetchPathPageData({ path: props.path }));
  const node = createMemo(() => findPathNode(tree(), props.path));
  const [createOpen, setCreateOpen] = createSignal(false);

  return (
    <PathBrowserShell tree={tree()} activePath={props.path}>
      <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
        <PathHeader
          path={props.path}
          node={node()}
          actions={
            <PathQuickCreate path={props.path} open={createOpen()} onOpenChange={setCreateOpen} />
          }
        />

        <Show when={(node()?.children.length ?? 0) > 0}>
          <section>
            <h2 class={sectionTitleClass}>Subpaths</h2>
            <PathSubpathGrid nodes={node()?.children ?? []} />
          </section>
        </Show>

        <Suspense fallback={<PathNoteListSkeleton />}>
          <Show
            when={(data()?.notes.length ?? 0) > 0}
            fallback={
              <div class={css({ py: "10", textAlign: "center", color: "fg.muted", fontSize: "sm" })}>
                <p>
                  Nothing is filed under{" "}
                  <span class={css({ fontFamily: "mono", color: "fg.default" })}>{props.path}</span>{" "}
                  yet.
                </p>
                <button
                  type="button"
                  class={css({ mt: "2", color: "fg.default", textDecoration: "underline", cursor: "pointer" })}
                  onClick={() => setCreateOpen(true)}
                >
                  Create the first note here
                </button>
              </div>
            }
          >
            <PathNoteList
              path={props.path}
              notes={data()?.notes ?? []}
              onCreateNote={() => setCreateOpen(true)}
            />
          </Show>
        </Suspense>
      </div>
    </PathBrowserShell>
  );
};
