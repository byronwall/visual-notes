import { CollectionView } from "~/lib/note-content/collection-view";
import { createRoot, onCleanup, onMount, type Owner } from "solid-js";
import { insert } from "solid-js/web";
import { css } from "styled-system/css";
import { createSolidNodeViewRenderer, NodeViewWrapper, useSolidNodeView } from "../nodeviews";

export type CollectionViewNodeOptions = {
  /** Solid owner of the editor, so the embed can reach router and app contexts. */
  owner: Owner | null;
  /** The note being edited; embedded views record it as their host. */
  noteId?: () => string | undefined;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    collectionView: {
      insertCollectionView: (viewId?: string | null) => ReturnType;
    };
  }
}

const wrapper = css({
  my: "4",
  position: "relative",
  "&.ProseMirror-selectednode": { outline: "2px solid token(colors.border.accent)", outlineOffset: "4px", borderRadius: "l2" },
});

function CollectionViewNodeView() {
  const { state } = useSolidNodeView<{ viewId: string | null }>();
  const options = state().extension.options as CollectionViewNodeOptions;
  let host: HTMLDivElement | undefined;
  // Update this node by position: `updateAttributes` targets the selection,
  // which has usually moved on by the time a picker resolves.
  const setViewId = (viewId: string) => {
    const pos = state().getPos();
    if (typeof pos !== "number") return;
    const { editor } = state();
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...state().node.attrs, viewId }));
  };

  onMount(() => {
    if (!host) return;
    const target = host;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      dispose?.();
    });
    // Loaded lazily so the editor bundle (and editor tests) skip collections code.
    void import("~/components/collections/embed/CollectionEmbed").then(({ CollectionEmbed }) => {
      if (cancelled) return;
      dispose = createRoot((disposeRoot) => {
      insert(target, () => (
        <CollectionEmbed
          viewId={state().node.attrs.viewId}
          hostDocId={options.noteId?.()}
          editable={state().editor.isEditable}
          onPick={(viewId) => setViewId(viewId)}
          onRemove={() => state().deleteNode()}
        />
      ));
        return disposeRoot;
      }, options.owner ?? undefined);
    });
  });

  return (
    <NodeViewWrapper class={wrapper} contentEditable={false} data-collection-view={state().node.attrs.viewId ?? ""}>
      <div ref={host} />
    </NodeViewWrapper>
  );
}

/**
 * A live, editable collection view inside a note. Stored as
 * `<div data-collection-view="viewId">`; the view's config lives server-side.
 */
export const CollectionViewNode = CollectionView.extend<CollectionViewNodeOptions>({
  addOptions() {
    return { owner: null, noteId: undefined };
  },

  addCommands() {
    return {
      insertCollectionView:
        (viewId = null) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { viewId } }),
    };
  },

  addNodeView() {
    return createSolidNodeViewRenderer(CollectionViewNodeView, {
      // The embed is a full app surface: keep every event inside it away from
      // ProseMirror except drags that start on the node's drag handle.
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        if (event.type.startsWith("drag") && target.closest("[data-drag-handle]")) return false;
        return Boolean(target.closest("[data-collection-embed]"));
      },
      ignoreMutation: () => true,
    });
  },
});
