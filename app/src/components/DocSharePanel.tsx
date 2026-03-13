import { A, useAction } from "@solidjs/router";
import { CopyIcon, ExternalLinkIcon, Globe2Icon, Link2OffIcon } from "lucide-solid";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { useToasts } from "~/components/Toast";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import {
  deleteDocShare,
  upsertDocShare,
  type DocShareSummary,
} from "~/services/doc-shares.service";
import { buildShareAbsoluteUrl } from "~/services/doc-shares.shared";
import { getBaseUrl } from "~/utils/base-url";

type DocSharePanelProps = {
  docId: string;
  initialShare?: DocShareSummary | null;
};

export function DocSharePanel(props: DocSharePanelProps) {
  const [share, setShare] = createSignal(props.initialShare ?? null);
  const [slugDraft, setSlugDraft] = createSignal(props.initialShare?.slug ?? "");
  const [busy, setBusy] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const runUpsertDocShare = useAction(upsertDocShare);
  const runDeleteDocShare = useAction(deleteDocShare);
  const { show: showToast } = useToasts();

  createEffect(() => {
    setShare(props.initialShare ?? null);
    setSlugDraft(props.initialShare?.slug ?? "");
  });

  const sharePath = createMemo(() => share()?.shareUrl || "");
  const handleSave = async () => {
    const hadShare = share() !== null;
    setBusy(true);
    try {
      const next = await runUpsertDocShare({
        docId: props.docId,
        slug: slugDraft().trim() || undefined,
      });
      setShare(next);
      setSlugDraft(next.slug);
      showToast({
        title: hadShare ? "Share updated" : "Share created",
        message: "The public share link is ready.",
      });
    } catch (error) {
      alert((error as Error).message || "Failed to save share link");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelShare = async () => {
    setBusy(true);
    try {
      await runDeleteDocShare({ docId: props.docId });
      setShare(null);
      setSlugDraft("");
      showToast({
        title: "Share removed",
        message: "The public link no longer works.",
      });
      setOpen(false);
    } catch (error) {
      alert((error as Error).message || "Failed to remove share link");
    } finally {
      setBusy(false);
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          colorPalette={share() ? "green" : "gray"}
          borderColor={share() ? "green.7" : "gray.outline.border"}
          bg={share() ? "green.subtle" : "bg.default"}
          color={share() ? "green.fg" : "fg.default"}
          title={share() ? `Shared at ${sharePath()}` : "Create a share link"}
          onClick={() => setOpen((value) => !value)}
        >
          <Globe2Icon size={14} />
          {share() ? "Shared" : "Share"}
        </Button>
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
                <A href={current().shareUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="green"
                  >
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
