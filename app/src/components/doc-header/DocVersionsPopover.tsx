import { createAsync, useAction } from "@solidjs/router";
import { BotIcon, HistoryIcon } from "lucide-solid";
import {
  For,
  Show,
  createSignal,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";
import { HStack, Stack, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import {
  fetchDocRevisions,
  restoreDocRevision,
  type DocRevisionItem,
} from "~/services/doc-revisions";
import { formatRelativeShort } from "./relative-time";

const REASON_LABELS: Record<string, string> = {
  "chatgpt.update": "Before ChatGPT edit",
  "chatgpt.append": "Before ChatGPT append",
  restore: "Before restore",
};

type Props = {
  docId: string;
  /** Flushes pending editor changes so a restore is not overwritten. */
  onBeforeRestore?: () => Promise<void>;
  /** Reloads the note after its content was replaced. */
  onRestored?: () => void;
};

/**
 * Header chip for notes ChatGPT created or edited: shows the origin and the
 * saved versions, each restorable. Renders nothing for ordinary notes.
 */
export const DocVersionsPopover: VoidComponent<Props> = (props) => {
  const info = createAsync(() => fetchDocRevisions(props.docId));
  const restore = useAction(restoreDocRevision);
  const [open, setOpen] = createSignal(false);
  const [restoringId, setRestoringId] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  const revisions = () => info()?.revisions ?? [];
  const visible = () =>
    Boolean(info()?.savedByChatGpt) || revisions().length > 0;
  const chipLabel = () => {
    const count = revisions().length;
    const versions = count ? `${count + 1} versions` : "";
    if (info()?.savedByChatGpt)
      return versions ? `ChatGPT · ${versions}` : "ChatGPT";
    return versions;
  };

  const onRestore = async (revision: DocRevisionItem) => {
    setRestoringId(revision.id);
    setError(null);
    try {
      await props.onBeforeRestore?.();
      await restore(revision.id);
      console.info("[doc-versions] restored", revision.id);
      setOpen(false);
      props.onRestored?.();
    } catch (err) {
      setError((err as Error)?.message || "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Show when={visible()}>
      <SimplePopover
        open={open()}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        offset={6}
        anchor={
          <styled.button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Note origin and versions"
            title={chipLabel()}
            display="inline-flex"
            alignItems="center"
            gap="1"
            fontSize="xs"
            color="fg.muted"
            px="1.5"
            h="7"
            borderRadius="l2"
            cursor="pointer"
            whiteSpace="nowrap"
            focusVisibleRing="outside"
            transitionProperty="background-color, color"
            transitionDuration="140ms"
            _hover={{ bg: "gray.plain.bg.hover", color: "fg.default" }}
          >
            <Show
              when={info()?.savedByChatGpt}
              fallback={<HistoryIcon size={13} />}
            >
              <BotIcon size={13} />
            </Show>
            {/* Narrow headers keep only the icon and version count. */}
            <styled.span display={{ base: "none", md: "inline" }}>
              {chipLabel()}
            </styled.span>
            <styled.span
              display={{ base: "inline", md: "none" }}
              fontVariantNumeric="tabular-nums"
            >
              {revisions().length ? revisions().length + 1 : ""}
            </styled.span>
          </styled.button>
        }
      >
        <Stack gap="2" p="3" minW="64" maxW="calc(100vw - 32px)">
          <Stack gap="0.5">
            <Text fontSize="sm" fontWeight="semibold">
              Versions
            </Text>
            <Show when={info()?.savedByChatGpt}>
              <Text fontSize="xs" color="fg.muted">
                Saved by ChatGPT. ChatGPT can keep editing this note.
              </Text>
            </Show>
          </Stack>
          <HStack
            justifyContent="space-between"
            bg="bg.subtle"
            borderRadius="l2"
            px="2.5"
            py="1.5"
          >
            <Text fontSize="sm">Current</Text>
            <Text fontSize="xs" color="fg.muted">
              now
            </Text>
          </HStack>
          <Show
            when={revisions().length}
            fallback={
              <Text fontSize="xs" color="fg.muted" px="1">
                No earlier versions yet.
              </Text>
            }
          >
            <Stack as="ul" gap="0.5" m="0" p="0" listStyle="none">
              <For each={revisions()}>
                {(revision) => (
                  <HStack
                    as="li"
                    gap="3"
                    justifyContent="space-between"
                    px="2.5"
                    py="1"
                    borderRadius="l2"
                    _hover={{ bg: "bg.subtle" }}
                  >
                    <Stack gap="0" minW="0">
                      <Text fontSize="sm" truncate>
                        {REASON_LABELS[revision.reason] ?? revision.reason}
                      </Text>
                      <Text
                        fontSize="xs"
                        color="fg.muted"
                        title={revision.createdAt}
                      >
                        {formatRelativeShort(now(), revision.createdAt)}
                      </Text>
                    </Stack>
                    <Button
                      size="xs"
                      variant="outline"
                      loading={restoringId() === revision.id}
                      disabled={restoringId() !== null}
                      onClick={() => void onRestore(revision)}
                    >
                      Restore
                    </Button>
                  </HStack>
                )}
              </For>
            </Stack>
          </Show>
          <Show when={error()}>
            {(message) => (
              <Text fontSize="xs" color="fg.error">
                {message()}
              </Text>
            )}
          </Show>
        </Stack>
      </SimplePopover>
    </Show>
  );
};
