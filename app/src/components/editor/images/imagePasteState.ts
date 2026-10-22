import type { Node as PMNode } from "@tiptap/pm/model";
import {
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { currentOrigin, importableImageSrc } from "./transferImages";
import {
  renderUploadPlaceholder,
  type PlaceholderStatus,
} from "./uploadPlaceholder";

/** Set on a transaction whose inserted images should be copied into storage. */
export const IMPORT_IMAGES_META = "vnImportImages";

export type UploadSpec = {
  id: string;
  previewUrl: string;
  status: PlaceholderStatus;
  message?: string;
  /** False when retrying cannot help (unsupported format, too large). */
  retryable?: boolean;
  aspect?: number;
};

export type ImagePasteState = {
  /** Widgets standing in for images still uploading (or failed). */
  placeholders: DecorationSet;
  /** Node decorations on images whose bytes are being replaced. */
  replacing: DecorationSet;
  /** Image srcs being copied from another site or a data url. */
  importing: ReadonlySet<string>;
};

export type ImagePasteAction =
  | { type: "placeholder"; pos?: number; spec: UploadSpec }
  | { type: "removePlaceholder"; id: string }
  | { type: "replaceStart"; pos: number; id: string }
  | { type: "replaceEnd"; id: string }
  | { type: "import"; src: string }
  | { type: "importDone"; src: string };

export const imagePasteKey = new PluginKey<ImagePasteState>("vnImagePaste");

export type PlaceholderHandlers = {
  retry: (id: string) => void;
  remove: (id: string) => void;
};

function placeholderDecoration(
  pos: number,
  spec: UploadSpec,
  handlers: PlaceholderHandlers,
) {
  return Decoration.widget(pos, () => renderUploadPlaceholder(spec, handlers), {
    id: spec.id,
    upload: spec,
    // A new key re-renders the widget when it fails, retries, or learns its
    // aspect ratio; an unchanged key keeps the existing DOM.
    key: `${spec.id}:${spec.status}:${spec.aspect ?? ""}`,
    side: 1,
    ignoreSelection: true,
    stopEvent: () => true,
  });
}

export function findPlaceholder(state: EditorState, id: string) {
  const set = imagePasteKey.getState(state)?.placeholders;
  const found = set?.find(undefined, undefined, (spec) => spec.id === id)[0];
  return found
    ? { pos: found.from, spec: found.spec.upload as UploadSpec }
    : null;
}

export function findReplacing(state: EditorState, id: string): number | null {
  const set = imagePasteKey.getState(state)?.replacing;
  const found = set?.find(undefined, undefined, (spec) => spec.id === id)[0];
  return found ? found.from : null;
}

/** Image srcs that need importing inside the ranges this transaction changed. */
export function importableSrcsInChange(tr: Transaction, origin?: string) {
  const srcs = new Set<string>();
  const { maps } = tr.mapping;
  maps.forEach((map, index) => {
    const rest = tr.mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const from = rest.map(newStart, -1);
      const to = Math.min(rest.map(newEnd, 1), tr.doc.content.size);
      if (to <= from) return;
      tr.doc.nodesBetween(from, to, (node: PMNode) => {
        if (node.type.name !== "image") return;
        const src = String(node.attrs.src ?? "");
        if (importableImageSrc(src, origin)) srcs.add(src);
      });
    });
  });
  return srcs;
}

export function createImagePasteState(handlers: PlaceholderHandlers) {
  return {
    init: (): ImagePasteState => ({
      placeholders: DecorationSet.empty,
      replacing: DecorationSet.empty,
      importing: new Set(),
    }),
    apply(tr: Transaction, prev: ImagePasteState): ImagePasteState {
      let placeholders = prev.placeholders.map(tr.mapping, tr.doc);
      let replacing = prev.replacing.map(tr.mapping, tr.doc);
      let importing = prev.importing;
      const action = tr.getMeta(imagePasteKey) as ImagePasteAction | undefined;

      if (action?.type === "placeholder") {
        const existing = placeholders.find(
          undefined,
          undefined,
          (spec) => spec.id === action.spec.id,
        );
        const pos = existing[0]?.from ?? action.pos;
        if (pos !== undefined) {
          placeholders = placeholders
            .remove(existing)
            .add(tr.doc, [placeholderDecoration(pos, action.spec, handlers)]);
        }
      } else if (action?.type === "removePlaceholder") {
        placeholders = placeholders.remove(
          placeholders.find(undefined, undefined, (s) => s.id === action.id),
        );
      } else if (action?.type === "replaceStart") {
        const node = tr.doc.nodeAt(action.pos);
        if (node) {
          replacing = replacing.add(tr.doc, [
            Decoration.node(
              action.pos,
              action.pos + node.nodeSize,
              { class: "vn-image-importing" },
              { id: action.id },
            ),
          ]);
        }
      } else if (action?.type === "replaceEnd") {
        replacing = replacing.remove(
          replacing.find(undefined, undefined, (s) => s.id === action.id),
        );
      } else if (action?.type === "import") {
        importing = new Set([...importing, action.src]);
      } else if (action?.type === "importDone") {
        const next = new Set(importing);
        next.delete(action.src);
        importing = next;
      }

      const uiEvent = tr.getMeta("uiEvent");
      if (
        tr.docChanged &&
        (uiEvent === "paste" ||
          uiEvent === "drop" ||
          tr.getMeta(IMPORT_IMAGES_META))
      ) {
        const found = importableSrcsInChange(tr, currentOrigin());
        if (found.size > 0) importing = new Set([...importing, ...found]);
      }

      return { placeholders, replacing, importing };
    },
  };
}

/** Placeholders, in-place replacements, and images still being imported. */
export function imagePasteDecorations(state: EditorState) {
  const plugin = imagePasteKey.getState(state);
  if (!plugin) return null;
  let set = plugin.placeholders;
  const extra: Decoration[] = plugin.replacing.find();
  if (plugin.importing.size > 0) {
    state.doc.descendants((node, pos) => {
      if (node.type.name !== "image") return;
      if (plugin.importing.has(String(node.attrs.src ?? ""))) {
        extra.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: "vn-image-importing",
          }),
        );
      }
    });
  }
  if (extra.length) set = set.add(state.doc, extra);
  return set;
}
