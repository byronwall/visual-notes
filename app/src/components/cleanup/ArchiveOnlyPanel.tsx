import { useAction } from "@solidjs/router";
import { Show, createMemo, createSignal, type VoidComponent } from "solid-js";
import { Stack } from "styled-system/jsx";
import { css, cx } from "styled-system/css";
import { documentContentClass } from "~/components/document-content-styles";
import { useToasts } from "~/components/Toast";
import { Text } from "~/components/ui/text";
import { normalizeMarkdownToHtml } from "~/server/lib/markdown";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import {
  archiveOnlyAction,
  undoArchiveOnlyAction,
} from "~/services/cleanup/cleanup.actions";
import { CleanupActionBar } from "./CleanupActionBar";
import { PanelSection } from "./PanelSection";

const PREVIEW_CHARS = 900;

const preview = css({
  // Shorter on a phone, so the action bar clears the corner toast.
  maxH: { base: "12rem", lg: "20rem" },
  overflowY: "auto",
  overflowWrap: "anywhere",
  "& .vn-doc-content": { fontSize: "sm", p: "0" },
});

/** The note's Markdown for the preview, without its block ids or a title line. */
export function previewMarkdown(markdown: string, title: string) {
  const text = markdown
    .replace(/\s*\^[\w-]{6,}\s*$/gm, "")
    .trim()
    .replace(/^#\s+(.*)(\n|$)/, (line, heading: string) =>
      heading.trim() === title.trim() ? "" : line,
    )
    .trim();
  if (text.length <= PREVIEW_CHARS) return text;
  // Cut between lines, so a link or a heading is not left half written.
  const cut = text.lastIndexOf("\n", PREVIEW_CHARS);
  return `${text.slice(0, cut > 0 ? cut : PREVIEW_CHARS).trimEnd()}…`;
}

/**
 * Delete, or a passed event with nothing reusable: show what the note holds
 * and archive it. The archive deletes it after 30 days.
 */
export const ArchiveOnlyPanel: VoidComponent<{
  item: CleanupItemDetail;
  reason: "delete" | "post_event";
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
}> = (props) => {
  const archive = useAction(archiveOnlyAction);
  const undoArchive = useAction(undoArchiveOnlyAction);
  const toasts = useToasts();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const text = () => previewMarkdown(props.item.markdown, props.item.title);
  const html = createMemo(() => normalizeMarkdownToHtml(text()));

  const undo = async (docId: string) => {
    try {
      await undoArchive(docId);
    } catch (err) {
      toasts.show({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const approve = async () => {
    const { docId, title } = props.item;
    setBusy(true);
    setError(null);
    try {
      await archive({ docId, reason: props.reason });
      toasts.show({
        message: `Archived ${title || "Untitled note"}`,
        actionLabel: "Undo",
        onClick: () => void undo(docId),
      });
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="4" flex="1" minH="0">
      <PanelSection
        title={
          props.reason === "delete" ? "What it holds" : "Nothing reusable found"
        }
      >
        <Show
          when={text()}
          fallback={
            <Text fontSize="sm" color="fg.muted">
              This note is empty.
            </Text>
          }
        >
          <div
            data-testid="archive-preview"
            class={cx(documentContentClass, preview)}
          >
            <div class="vn-doc-content prose editor-prose" innerHTML={html()} />
          </div>
        </Show>
      </PanelSection>
      <Text fontSize="xs" color="fg.muted">
        Archiving hides it now; it is deleted after 30 days unless you restore
        it.
      </Text>
      <Show when={error()}>
        {(message) => (
          <Text fontSize="sm" color="fg.error">
            {message()}
          </Text>
        )}
      </Show>
      <CleanupActionBar
        primaryLabel="Archive"
        onPrimary={approve}
        busy={busy()}
        onKeep={props.onKeep}
        onSkip={props.onSkip}
      />
    </Stack>
  );
};
