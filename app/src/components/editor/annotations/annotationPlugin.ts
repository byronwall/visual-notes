import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { locateQuote } from "~/lib/annotations/anchor";
import type {
  AnchorUpdate,
  AnnotationColor,
  AnnotationView,
} from "~/lib/annotations/types";
import { findBlock } from "../proposals/proposalTransaction";
import { blockText } from "./blockText";

// Draws passage annotations as colored highlights. A highlight follows edits
// through the transaction mapping. Deleting the passage loses it; a remote
// version makes the plugin look for the quoted text again.

export type Range = { from: number; to: number };

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

function resolve(doc: PMNode, annotation: AnnotationView): Range | null {
  if (!annotation.blockId || !annotation.quote || annotation.detached) return null;
  const block = findBlock(doc, annotation.blockId);
  if (!block || !block.node.isTextblock) return null;
  const text = blockText(block.node, block.pos);
  const start = locateQuote(text.text, annotation.quote, annotation.quoteStart);
  if (start === null) return null;
  return { from: text.posAt(start), to: text.posAt(start + annotation.quote.length) };
}

function decorate(doc: PMNode, state: Omit<State, "decorations">): DecorationSet {
  const decorations: Decoration[] = [];
  for (const annotation of state.annotations) {
    const range = state.ranges.get(annotation.id);
    if (!range || range.to <= range.from) continue;
    const color = state.colors[annotation.typeId] ?? "amber";
    const active = annotation.id === state.activeId;
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class: "vn-annotation",
        "data-annotation-id": annotation.id,
        "data-active": String(active),
        style: `background-color: var(--colors-${color}-a${active ? 6 : 4}); box-shadow: inset 0 -2px 0 var(--colors-${color}-a9); border-radius: 2px; cursor: pointer;`,
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
            if (to > from && next.doc.resolve(from).parent === next.doc.resolve(to).parent) {
              range = { from, to };
            }
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
            range = resolve(next.doc, annotation);
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
            handlers.select(id);
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
      const $from = state.doc.resolve(range.from);
      const block = $from.parent;
      const blockId = block.attrs?.id;
      if (typeof blockId !== "string") continue;
      const text = blockText(block, $from.before());
      const quote = text.text.slice(text.offsetAt(range.from), text.offsetAt(range.to));
      const quoteStart = text.offsetAt(range.from);
      if (
        blockId !== annotation.blockId ||
        quote !== annotation.quote ||
        quoteStart !== annotation.quoteStart ||
        annotation.detached
      ) {
        updates.push({ id: annotation.id, blockId, quote, quoteStart, detached: false });
      }
    } else if (plugin.lost.has(annotation.id) && !annotation.detached) {
      updates.push({
        id: annotation.id,
        blockId: annotation.blockId,
        quote: annotation.quote ?? "",
        quoteStart: annotation.quoteStart ?? 0,
        detached: true,
      });
    }
  }
  return updates;
}

/** The passage under the selection, when it sits inside one block with an id. */
export function selectionPassage(state: EditorState) {
  const { from, to, empty } = state.selection;
  if (empty) return null;
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  if ($from.parent !== $to.parent || !$from.parent.isTextblock) return null;
  const blockId = $from.parent.attrs?.id;
  if (typeof blockId !== "string" || !blockId) return null;
  const text = blockText($from.parent, $from.before());
  const quoteStart = text.offsetAt(from);
  const quote = text.text.slice(quoteStart, text.offsetAt(to));
  if (!quote.trim()) return null;
  return { blockId, quote, quoteStart, from, to };
}
