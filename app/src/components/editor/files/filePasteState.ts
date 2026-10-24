import {
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { css } from "styled-system/css";
import { formatFileSize } from "~/services/doc-files/doc-files.shared";

// Upload placeholders for attachments. They are decorations, not nodes, so a
// half-uploaded file never reaches the saved note. Plain DOM: ProseMirror
// widgets render outside Solid. Progress updates the bar in place.

export type FileUploadSpec = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "failed";
  message?: string;
  retryable?: boolean;
};

export type FilePlaceholderHandlers = {
  retry: (id: string) => void;
  remove: (id: string) => void;
};

export type FilePasteAction =
  | { type: "placeholder"; pos?: number; spec: FileUploadSpec }
  | { type: "remove"; id: string };

export const filePasteKey = new PluginKey<DecorationSet>("filePaste");

/** Live progress bars by upload id, updated without a transaction. */
const progressBars = new Map<
  string,
  { bar: HTMLElement; label: HTMLElement }
>();

export function setUploadProgress(id: string, fraction: number, size: number) {
  const found = progressBars.get(id);
  if (!found) return;
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  found.bar.style.transform = `scaleX(${pct / 100})`;
  found.label.textContent = `Uploading ${pct}% of ${formatFileSize(size)}`;
}

const rootClass = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "3",
  my: "2",
  px: "3",
  py: "2.5",
  borderRadius: "l2",
  bg: "bg.subtle",
  overflow: "hidden",
  userSelect: "none",
  "&[data-status=failed]": { bg: "red.a2" },
});
const glyphClass = css({
  display: "grid",
  placeItems: "center",
  w: "9",
  h: "9",
  flexShrink: "0",
  borderRadius: "l2",
  bg: "bg.emphasized",
  color: "fg.muted",
  fontSize: "md",
});
const textClass = css({ minW: "0", flex: "1" });
const nameClass = css({
  fontFamily: "mono",
  fontSize: "sm",
  color: "fg.default",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const metaClass = css({
  fontSize: "xs",
  color: "fg.muted",
  "[data-status=failed] &": { color: "fg.error" },
});
const trackClass = css({
  position: "absolute",
  insetInline: "0",
  bottom: "0",
  height: "2px",
  bg: "gray.a3",
});
const barClass = css({
  height: "100%",
  bg: "blue.9",
  transformOrigin: "left",
  transform: "scaleX(0)",
  transition: "transform 160ms ease-out",
});
const buttonClass = css({
  px: "2",
  py: "1",
  borderRadius: "l1",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.default",
  cursor: "pointer",
  _hover: { bg: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
});

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPlaceholder(
  spec: FileUploadSpec,
  handlers: FilePlaceholderHandlers,
): HTMLElement {
  const root = el("div", rootClass);
  root.dataset.status = spec.status;
  root.dataset.fileUpload = spec.id;
  root.contentEditable = "false";
  root.append(el("div", glyphClass, spec.status === "failed" ? "!" : "⤒"));
  const text = el("div", textClass);
  text.append(el("div", nameClass, spec.name));
  const meta = el(
    "div",
    metaClass,
    spec.status === "failed"
      ? spec.message || "Upload failed"
      : `Uploading 0% of ${formatFileSize(spec.size)}`,
  );
  text.append(meta);
  root.append(text);

  if (spec.status === "uploading") {
    const track = el("div", trackClass);
    const bar = el("div", barClass);
    track.append(bar);
    root.append(track);
    progressBars.set(spec.id, { bar, label: meta });
  } else {
    progressBars.delete(spec.id);
    const action = (label: string, run: () => void) => {
      const button = el("button", buttonClass, label);
      button.type = "button";
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", run);
      root.append(button);
    };
    if (spec.retryable !== false)
      action("Retry", () => handlers.retry(spec.id));
    action("Remove", () => handlers.remove(spec.id));
  }
  return root;
}

function placeholderDecoration(
  pos: number,
  spec: FileUploadSpec,
  handlers: FilePlaceholderHandlers,
) {
  return Decoration.widget(pos, () => renderPlaceholder(spec, handlers), {
    id: spec.id,
    upload: spec,
    key: `${spec.id}:${spec.status}`,
    side: 1,
    ignoreSelection: true,
    stopEvent: () => true,
    destroy: () => {
      if (spec.status === "uploading") progressBars.delete(spec.id);
    },
  });
}

export function findFilePlaceholder(state: EditorState, id: string) {
  const set = filePasteKey.getState(state);
  const found = set?.find(undefined, undefined, (spec) => spec.id === id)[0];
  return found
    ? { pos: found.from, spec: found.spec.upload as FileUploadSpec }
    : null;
}

export function createFilePasteState(handlers: FilePlaceholderHandlers) {
  return {
    init: () => DecorationSet.empty,
    apply(tr: Transaction, prev: DecorationSet): DecorationSet {
      let set = prev.map(tr.mapping, tr.doc);
      const action = tr.getMeta(filePasteKey) as FilePasteAction | undefined;
      if (action?.type === "placeholder") {
        const existing = set.find(
          undefined,
          undefined,
          (spec) => spec.id === action.spec.id,
        );
        const pos = existing[0]?.from ?? action.pos;
        if (pos !== undefined) {
          set = set
            .remove(existing)
            .add(tr.doc, [placeholderDecoration(pos, action.spec, handlers)]);
        }
      } else if (action?.type === "remove") {
        set = set.remove(
          set.find(undefined, undefined, (spec) => spec.id === action.id),
        );
      }
      return set;
    },
  };
}
