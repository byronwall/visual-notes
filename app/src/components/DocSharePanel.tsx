import { A, useAction } from "@solidjs/router";
import {
  CopyIcon,
  ExternalLinkIcon,
  Globe2Icon,
  Link2OffIcon,
} from "lucide-solid";
import {
  Show,
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { useToasts } from "~/components/Toast";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import {
  deleteDocShare,
  upsertDocShare,
  type DocShareSummary,
} from "~/services/doc-shares.service";
import {
  buildShareAbsoluteUrl,
  isDocShareDeleteAcknowledged,
  isDocShareSelectionCurrent,
  isDocShareUpsertAcknowledged,
  type DocShareSelection,
} from "~/services/doc-shares.shared";
import { getBaseUrl } from "~/utils/base-url";

type DocSharePanelProps = {
  docId: string;
  initialShare?: DocShareSummary | null;
  iconOnly?: boolean;
};

export function DocSharePanel(props: DocSharePanelProps) {
  const [share, setShare] = createSignal(props.initialShare ?? null);
  const [slugDraft, setSlugDraft] = createSignal(
    props.initialShare?.slug ?? "",
  );
  const [busy, setBusy] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  let selectedDocId: string | undefined = undefined;
  let selectionGeneration = 0;
  let disposed = false;
  const runUpsertDocShare = useAction(upsertDocShare);
  const runDeleteDocShare = useAction(deleteDocShare);
  const { show: showToast } = useToasts();

  const isCurrentSelection = (
    submitted: DocShareSelection,
    currentDocId: string,
  ) =>
    isDocShareSelectionCurrent(
      submitted,
      { docId: currentDocId, generation: selectionGeneration },
      disposed,
    );

  onCleanup(() => {
    disposed = true;
  });

  createEffect(() => {
    const docId = props.docId;
    const initialShare = props.initialShare ?? null;
    const selectionChanged =
      selectedDocId !== undefined && docId !== selectedDocId;
    selectedDocId = docId;
    if (selectionChanged) {
      selectionGeneration += 1;
    }

    batch(() => {
      if (selectionChanged) setBusy(false);
      setShare(initialShare);
      setSlugDraft(initialShare?.slug ?? "");
    });
  });

  const sharePath = createMemo(() => share()?.shareUrl || "");
  const handleSave = async () => {
    const hadShare = share() !== null;
    const submittedDocId = props.docId;
    const submittedSelection = {
      docId: submittedDocId,
      generation: selectionGeneration,
    };
    const submittedSlugDraft = slugDraft();
    const submittedSlug = submittedSlugDraft.trim() || undefined;
    setBusy(true);
    try {
      const next = await runUpsertDocShare({
        docId: submittedDocId,
        slug: submittedSlug,
      });
      if (!isDocShareUpsertAcknowledged(next)) {
        throw new Error("The server did not confirm the share link.");
      }
      if (!isCurrentSelection(submittedSelection, props.docId)) return;
      setShare(next);
      if (slugDraft() === submittedSlugDraft) setSlugDraft(next.slug);
      showToast({
        title: hadShare ? "Share updated" : "Share created",
        message: "The public share link is ready.",
      });
    } catch (error) {
      if (!isCurrentSelection(submittedSelection, props.docId)) return;
      alert((error as Error).message || "Failed to save share link");
    } finally {
      if (isCurrentSelection(submittedSelection, props.docId)) setBusy(false);
    }
  };

  const handleCancelShare = async () => {
    const submittedDocId = props.docId;
    const submittedSelection = {
      docId: submittedDocId,
      generation: selectionGeneration,
    };
    setBusy(true);
    try {
      const result = await runDeleteDocShare({ docId: submittedDocId });
      if (!isDocShareDeleteAcknowledged(result, submittedDocId)) {
        throw new Error("The server did not confirm the share removal.");
      }
      if (!isCurrentSelection(submittedSelection, props.docId)) return;
      setShare(null);
      setSlugDraft("");
      showToast({
        title: "Share removed",
        message: "The public link no longer works.",
      });
      setOpen(false);
    } catch (error) {
      if (!isCurrentSelection(submittedSelection, props.docId)) return;
      alert((error as Error).message || "Failed to remove share link");
    } finally {
      if (isCurrentSelection(submittedSelection, props.docId)) setBusy(false);
    }
  };

  const handleCopy = async () => {
    const current = share();
    if (!current) return;
    const value = buildShareAbsoluteUrl(getBaseUrl(), current.shareUrl);
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast({ title: "Copied", message: value });
    } catch {
      alert(value);
    }
  };

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={8}
      style={{
        width: "fit-content",
        "max-width": "min(28rem, calc(100vw - 1rem))",
      }}
      anchor={
        <Show
          when={props.iconOnly}
          fallback={
            <Button
              type="button"
              size="sm"
              variant="outline"
              colorPalette={share() ? "green" : "gray"}
              borderColor={share() ? "green.7" : "gray.outline.border"}
              bg={share() ? "green.subtle" : "bg.default"}
              color={share() ? "green.fg" : "fg.default"}
              title={
                share() ? `Shared at ${sharePath()}` : "Create a share link"
              }
              onClick={() => setOpen((value) => !value)}
            >
              <Globe2Icon size={14} />
              {share() ? "Shared" : "Share"}
            </Button>
          }
        >
          <Tooltip
            content={share() ? "Share settings" : "Share note"}
            showArrow
            portalled={false}
            contentProps={{ zIndex: "tooltip" }}
          >
            <Button
              type="button"
              size="xs"
              variant="plain"
              colorPalette={share() ? "green" : "gray"}
              bg={share() ? "green.subtle.bg" : "transparent"}
              color={share() ? "green.11" : "fg.muted"}
              _hover={{
                bg: share() ? "green.subtle.bg.hover" : "gray.plain.bg.hover",
                color: share() ? "green.12" : "fg.default",
              }}
              aria-label={
                share() ? "Manage shared note link" : "Create a share link"
              }
              onClick={() => setOpen((value) => !value)}
              minW="7"
              w="7"
              h="7"
              px="0"
            >
              <Globe2Icon size={14} />
            </Button>
          </Tooltip>
        </Show>
      }
    >
      <Stack gap="3" p="3">
        <Text fontSize="sm" fontWeight="semibold">
          Public share
        </Text>

        <Stack gap="2">
          <HStack gap="2" alignItems="center" flexWrap="wrap">
            <Text
              fontSize="sm"
              color="fg.muted"
              fontFamily="mono"
              whiteSpace="nowrap"
            >
              /share/
            </Text>
            <Input
              value={slugDraft()}
              placeholder="defaults to generated id"
              onInput={(event) => setSlugDraft(event.currentTarget.value)}
              fontFamily="mono"
              minW="14rem"
            />
            <Button loading={busy()} onClick={() => void handleSave()}>
              {share() ? "Update" : "Create"}
            </Button>
          </HStack>
        </Stack>

        <Show
          when={share()}
          fallback={
            <Text fontSize="sm" color="fg.muted">
              Not shared
            </Text>
          }
        >
          {(current) => (
            <Stack gap="2">
              <HStack gap="2" flexWrap="wrap">
                <A
                  href={current().shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" colorPalette="green">
                    <ExternalLinkIcon size={14} />
                    Open shared story
                  </Button>
                </A>
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="gray"
                  onClick={() => void handleCopy()}
                >
                  <CopyIcon size={14} />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="red"
                  loading={busy()}
                  onClick={() => void handleCancelShare()}
                >
                  <Link2OffIcon size={14} />
                  Cancel share
                </Button>
              </HStack>
              <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                {sharePath()}
              </Text>
            </Stack>
          )}
        </Show>
      </Stack>
    </SimplePopover>
  );
}
