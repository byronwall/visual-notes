import { DownloadIcon, ExternalLinkIcon } from "lucide-solid";
import { Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import {
  FileAttachment,
  type FileAttachmentAttrs,
} from "~/lib/note-content/file-attachment";
import {
  fileKind,
  formatFileSize,
} from "~/services/doc-files/doc-files.shared";
import {
  FileKindIcon,
  fileKindLabel,
  PREVIEWABLE_KINDS,
} from "../files/FileKindIcon";
import {
  createSolidNodeViewRenderer,
  NodeViewWrapper,
  useSolidNodeView,
} from "../nodeviews";

const cardClass = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  my: "2",
  px: "3",
  py: "2.5",
  borderRadius: "l2",
  bg: "bg.subtle",
  transition: "background 120ms ease-out",
  _hover: { bg: "bg.hover" },
  "&.ProseMirror-selectednode": {
    bg: "bg.selected",
    outline: "2px solid token(colors.border.selected)",
    outlineOffset: "1px",
  },
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
});
const textClass = css({ minW: "0", flex: "1" });
const nameClass = css({
  display: "block",
  maxW: "100%",
  fontFamily: "mono",
  fontSize: "sm",
  color: "fg.default",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "left",
});
const nameInputClass = css({
  w: "100%",
  fontFamily: "mono",
  fontSize: "sm",
  color: "fg.default",
  bg: "bg.default",
  px: "1",
  mx: "-1",
  borderRadius: "l1",
  outline: "2px solid token(colors.border.focus)",
});
const metaClass = css({ fontSize: "xs", color: "fg.muted" });
const actionClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "8",
  h: "8",
  flexShrink: "0",
  borderRadius: "l2",
  color: "fg.muted",
  _hover: { bg: "bg.active", color: "fg.default" },
  _focusVisible: { outline: "2px solid token(colors.border.focus)" },
});

function FileAttachmentNodeView() {
  const { state } = useSolidNodeView<FileAttachmentAttrs>();
  const attrs = () => state().node.attrs;
  const kind = createMemo(() => fileKind(attrs().name, attrs().mime ?? ""));
  const meta = () =>
    [fileKindLabel(kind(), attrs().name), formatFileSize(attrs().size)]
      .filter(Boolean)
      .join(" · ");
  const downloadHref = () =>
    attrs().src ? `${attrs().src}?download=1` : undefined;
  const [renaming, setRenaming] = createSignal(false);

  // Update by position: `updateAttributes` targets the selection, which a
  // click on the name may have moved.
  const rename = (value: string) => {
    setRenaming(false);
    const name = value.trim();
    const pos = state().getPos();
    const { editor } = state();
    if (!name || name === attrs().name || typeof pos !== "number") return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...attrs(), name }),
    );
  };

  return (
    <NodeViewWrapper
      class={cardClass}
      contentEditable={false}
      data-file-attachment=""
      data-kind={kind()}
    >
      <div class={glyphClass} aria-hidden="true">
        <FileKindIcon kind={kind()} />
      </div>
      <div class={textClass}>
        <Show
          when={renaming()}
          fallback={
            <a
              class={nameClass}
              href={attrs().src ?? undefined}
              target="_blank"
              rel="noopener"
              title={attrs().name}
              data-file-action="true"
              onDblClick={(e) => {
                if (!state().editor.isEditable) return;
                e.preventDefault();
                setRenaming(true);
              }}
            >
              {attrs().name}
            </a>
          }
        >
          <input
            class={nameInputClass}
            value={attrs().name}
            aria-label="File name"
            data-file-action="true"
            ref={(input) => queueMicrotask(() => input.select())}
            onBlur={(e) => rename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename(e.currentTarget.value);
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        </Show>
        <div class={metaClass}>{attrs().src ? meta() : "File is missing"}</div>
      </div>
      <Show when={attrs().src && PREVIEWABLE_KINDS.has(kind())}>
        <a
          class={actionClass}
          href={attrs().src!}
          target="_blank"
          rel="noopener"
          aria-label={`Open ${attrs().name}`}
          title="Open in a new tab"
          data-file-action="true"
        >
          <ExternalLinkIcon size={16} />
        </a>
      </Show>
      <Show when={downloadHref()}>
        <a
          class={actionClass}
          href={downloadHref()}
          download={attrs().name}
          aria-label={`Download ${attrs().name}`}
          title="Download"
          data-file-action="true"
        >
          <DownloadIcon size={16} />
        </a>
      </Show>
    </NodeViewWrapper>
  );
}

/** The editor's attachment card; see lib/note-content/file-attachment.ts. */
export const FileAttachmentNode = FileAttachment.extend({
  addNodeView() {
    return createSolidNodeViewRenderer(FileAttachmentNodeView, {
      // Links and the rename field act on their own; elsewhere a click
      // selects the card like any other block.
      stopEvent: ({ event }) =>
        !!(event.target as HTMLElement | null)?.closest(
          "[data-file-action='true']",
        ) && !event.type.startsWith("drag"),
      ignoreMutation: () => true,
    });
  },
});
