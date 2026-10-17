import { createEffect, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack, Stack } from "styled-system/jsx";
import {
  FileTextIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-solid";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import * as Popover from "~/components/ui/popover";
import { Text } from "~/components/ui/text";
import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";
import { formatBlockRange } from "./BlockFace";
import {
  formatDuration,
  formatMonthDay,
  formatWeekdayShort,
} from "./date-utils";
import { normalizeTimeBlockColor } from "./time-block-colors";

type Props = {
  block: TimeBlockItem | null;
  anchor: HTMLElement | null;
  onClose: () => void;
  onRename: (block: TimeBlockItem, title: string) => void;
  onToggleFixed: (block: TimeBlockItem) => void;
  onDelete: (block: TimeBlockItem) => void;
  onOpenEditor: (block: TimeBlockItem) => void;
};

/** Click-to-inspect card for a block: rename in place, then act on it. */
export const BlockQuickPopover = (props: Props) => {
  const [draftTitle, setDraftTitle] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    const block = props.block;
    if (!block) return;
    setDraftTitle(block.title ?? "");
  });

  const commitTitle = () => {
    const block = props.block;
    if (!block) return;
    const next = draftTitle().trim();
    if (next && next !== (block.title ?? "")) props.onRename(block, next);
  };

  return (
    <Popover.Root
      open={Boolean(props.block && props.anchor)}
      onOpenChange={(details) => {
        if (details.open) return;
        commitTitle();
        props.onClose();
      }}
      initialFocusEl={() => inputRef ?? null}
      positioning={{
        placement: "right-start",
        gutter: 8,
        getAnchorElement: () => props.anchor,
      }}
    >
      <Portal>
        <Popover.Positioner>
          <Popover.Content p="0" style={{ "max-width": "calc(100vw - 24px)" }}>
            <Show when={props.block}>
              {(block) => {
                const start = () => new Date(block().startTime);
                const end = () => new Date(block().endTime);
                const minutes = () =>
                  (end().getTime() - start().getTime()) / 60_000;
                return (
                  <Stack
                    gap="2"
                    p="3"
                    w="72"
                    maxW="full"
                    data-testid="time-block-quick-popover"
                  >
                    <HStack gap="2" alignItems="center">
                      <Box
                        w="2.5"
                        h="2.5"
                        borderRadius="full"
                        flexShrink={0}
                        style={{
                          "background-color": normalizeTimeBlockColor(
                            block().color,
                          ),
                        }}
                      />
                      <Input
                        ref={inputRef}
                        size="sm"
                        variant="flushed"
                        fontWeight="semibold"
                        aria-label="Block title"
                        placeholder="Untitled"
                        value={draftTitle()}
                        onFocus={(event) => event.currentTarget.select()}
                        onInput={(event) =>
                          setDraftTitle(event.currentTarget.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          commitTitle();
                          props.onClose();
                        }}
                      />
                    </HStack>
                    <Text
                      fontSize="sm"
                      color="fg.muted"
                      style={{ "font-variant-numeric": "tabular-nums" }}
                    >
                      {formatWeekdayShort(start())} {formatMonthDay(start())} ·{" "}
                      {formatBlockRange(start(), end())} ·{" "}
                      {formatDuration(minutes())}
                    </Text>
                    <Show when={block().noteId}>
                      <HStack gap="1.5" fontSize="sm" minW="0">
                        <FileTextIcon size={14} />
                        <a
                          href={`/docs/${block().noteId}`}
                          style={{
                            color: "var(--colors-fg-default)",
                            "min-width": "0",
                          }}
                        >
                          <Text
                            as="span"
                            fontSize="sm"
                            truncate
                            display="block"
                          >
                            {block().noteTitle || "Linked note"}
                          </Text>
                        </a>
                      </HStack>
                    </Show>
                    <Show when={block().comments}>
                      <Text
                        fontSize="sm"
                        color="fg.muted"
                        lineClamp={3}
                        whiteSpace="pre-wrap"
                      >
                        {block().comments}
                      </Text>
                    </Show>
                    <HStack gap="1" pt="1">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => props.onOpenEditor(block())}
                      >
                        <PencilIcon />
                        Details
                      </Button>
                      <IconButton
                        size="xs"
                        variant="plain"
                        aria-pressed={block().isFixedTime}
                        aria-label={
                          block().isFixedTime ? "Unlock time" : "Lock time"
                        }
                        title={
                          block().isFixedTime
                            ? "Fixed time — packing leaves it in place"
                            : "Lock time so packing leaves it in place"
                        }
                        onClick={() => props.onToggleFixed(block())}
                      >
                        <Show
                          when={block().isFixedTime}
                          fallback={<LockOpenIcon />}
                        >
                          <LockIcon />
                        </Show>
                      </IconButton>
                      <Box flex="1" />
                      <IconButton
                        size="xs"
                        variant="plain"
                        colorPalette="red"
                        aria-label="Delete block"
                        title="Delete block"
                        onClick={() => props.onDelete(block())}
                      >
                        <Trash2Icon />
                      </IconButton>
                    </HStack>
                  </Stack>
                );
              }}
            </Show>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
