import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type {
  AnchorUpdate,
  AnnotationColor,
  AnnotationView,
} from "~/lib/annotations/types";
import { passageAt, resolvePassage, type Range } from "./passage";

// Draws passage annotations as colored highlights; a passage may span
// blocks. A highlight follows edits through the transaction mapping.
// Deleting the passage loses it; a remote version makes the plugin look for
// the quoted text again.

export type { Range };

type State = {
  annotations: AnnotationView[];
  colors: Record<string, AnnotationColor>;
  activeId: string | null;
  ranges: Map<string, Range>;
  /** Annotations whose passage disappeared while the note was open. */
  lost: Set<string>;
  decorations: DecorationSet;
};

export type AnnotationLayerInput = {
  annotations: AnnotationView[];
  colors: Record<string, AnnotationColor>;
  activeId: string | null;
};

export const annotationKey = new PluginKey<State>("vnAnnotations");
const SET_META = "vnSetAnnotations";

function decorate(doc: PMNode, state: Omit<State, "decorations">): DecorationSet {
  const decorations: Decoration[] = [];
  for (const annotation of state.annotations) {
    const range = state.ranges.get(annotation.id);
    if (!range || range.to <= range.from) continue;
    const color = state.colors[annotation.typeId] ?? "amber";
    // Active, hover, and filter styles come from a stylesheet the layer
    // writes, so they never redraw the note.
    decorations.push(
      // Classes, not data attributes: highlights on the same words merge
      // into one span, and only classes keep every annotation and type.
      Decoration.inline(range.from, range.to, {
        class: `vn-annotation vn-a-${annotation.id} vn-t-${annotation.typeId}`,
        "data-annotation-id": annotation.id,
        style: `background-color: var(--colors-${color}-a4); box-shadow: inset 0 -2px 0 var(--colors-${color}-a9); border-radius: 2px; cursor: pointer; transition: background-color 140ms ease-out;`,
      }),
    );
  }
  return DecorationSet.create(doc, decorations);
}

export function createAnnotationPlugin(handlers: { select: (id: string) => void }) {
  return new Plugin<State>({
    key: annotationKey,
    state: {
      init: () => ({
        annotations: [],
        colors: {},
        activeId: null,
        ranges: new Map(),
        lost: new Set(),
        decorations: DecorationSet.empty,
      }),
      apply(tr, prev, _old, next) {
        const input = tr.getMeta(SET_META) as AnnotationLayerInput | undefined;
        if (!input && !tr.docChanged) return prev;
        const annotations = input?.annotations ?? prev.annotations;
        const ranges = new Map<string, Range>();
        const lost = new Set(prev.lost);
        const before = new Map(prev.annotations.map((a) => [a.id, a]));
        for (const annotation of annotations) {
          const old = prev.ranges.get(annotation.id);
          let range: Range | null = null;
          if (old && tr.docChanged) {
            const from = tr.mapping.map(old.from, 1);
            const to = tr.mapping.map(old.to, -1);
            if (to > from) range = { from, to };
          } else if (old && before.get(annotation.id)?.updatedAt === annotation.updatedAt) {
            // Unchanged on the server: keep the live range, which may be ahead
            // of the stored anchor until the next save.
            range = old;
          }
          // A typed edit that swallows the passage loses it. A remote version
          // (applied without an update event) may rewrite the block, so look
          // for the quote again before giving up.
          const remote = tr.getMeta("preventUpdate") === true;
          if (!range && (!old || !tr.docChanged || remote)) {
            range = resolvePassage(next.doc, annotation);
          }
          if (range) {
            ranges.set(annotation.id, range);
            lost.delete(annotation.id);
          } else if (old) {
            lost.add(annotation.id);
          }
        }
        const base = {
          annotations,
          colors: input?.colors ?? prev.colors,
          activeId: input ? input.activeId : prev.activeId,
          ranges,
          lost,
        };
        return { ...base, decorations: decorate(next.doc, base) };
      },
    },
    props: {
      decorations: (state) => annotationKey.getState(state)?.decorations,
      handleClick(view, pos) {
        const state = annotationKey.getState(view.state);
        if (!state) return false;
        for (const [id, range] of state.ranges) {
          if (pos >= range.from && pos <= range.to) {
            // Redrawing the highlight during the click would drop the caret
            // the click just placed, so mark it active once the click is done.
            setTimeout(() => handlers.select(id), 0);
            break;
          }
        }
        return false;
      },
    },
  });
}

export const setAnnotationsMeta = (input: AnnotationLayerInput) => [SET_META, input] as const;

export const annotationRanges = (state: EditorState) =>
  annotationKey.getState(state)?.ranges ?? new Map<string, Range>();

/**
 * Anchors that differ from what is stored: passages that moved, changed, or
 * were deleted while the note was open.
 */
export function anchorChanges(state: EditorState): AnchorUpdate[] {
  const plugin = annotationKey.getState(state);
  if (!plugin) return [];
  const updates: AnchorUpdate[] = [];
  for (const annotation of plugin.annotations) {
    if (!annotation.blockId) continue;
    const range = plugin.ranges.get(annotation.id);
    if (range) {
      const now = passageAt(state.doc, range.from, range.to);
      if (!now) continue;
      if (
        now.blockId !== annotation.blockId ||
        now.quote !== annotation.quote ||
        now.quoteStart !== annotation.quoteStart ||
        now.endBlockId !== annotation.endBlockId ||
        now.endOffset !== annotation.endOffset ||
        annotation.detached
      ) {
        updates.push({
          id: annotation.id,
          blockId: now.blockId,
          quote: now.quote,
          quoteStart: now.quoteStart,
          endBlockId: now.endBlockId,
          endOffset: now.endOffset,
          detached: false,
        });
      }
    } else if (plugin.lost.has(annotation.id) && !annotation.detached) {
      updates.push({
        id: annotation.id,
        blockId: annotation.blockId,
        quote: annotation.quote ?? "",
        quoteStart: annotation.quoteStart ?? 0,
        endBlockId: annotation.endBlockId,
        endOffset: annotation.endOffset,
        detached: true,
      });
    }
  }
  return updates;
}

/** The passage under the selection, across as many blocks as it covers. */
export function selectionPassage(state: EditorState) {
  const { from, to, empty } = state.selection;
  if (empty) return null;
  return passageAt(state.doc, from, to);
}
