import { CheckIcon, CopyIcon } from "lucide-solid";
import { For, Show, type Accessor } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { type ConsoleCaptureEntry } from "~/lib/console-log-capture";
import {
  detailsClass,
  levelChipClass,
  prefixChipClass,
  rowClass,
  rowTitleClass,
} from "./consoleLogPanel.styles";
import { formatTime } from "./consoleLogPanel.utils";

type ConsoleLogsListProps = {
  entries: Accessor<ConsoleCaptureEntry[]>;
  expandedIds: Accessor<Set<number>>;
  onToggleExpanded: (id: number) => void;
  copiedRowId: Accessor<number | null>;
  onCopyEntry: (entry: ConsoleCaptureEntry) => void;
  tooltipContentProps: { zIndex: "tooltip" };
};

export const ConsoleLogsList = (props: ConsoleLogsListProps) => {
  return (
    <Stack gap="0.5">
      <For each={props.entries()}>
        {(entry) => {
          const expanded = () => props.expandedIds().has(entry.id);
          return (
            <Box class={rowClass(expanded())}>
              <HStack
                role="button"
                tabIndex={0}
                gap="2"
                minW="0"
                alignItems="center"
                onClick={() => props.onToggleExpanded(entry.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    props.onToggleExpanded(entry.id);
                  }
                }}
              >
                <Text
                  fontSize="2xs"
                  color="fg.subtle"
                  flexShrink="0"
                  fontFamily="mono"
                >
                  {formatTime(entry.timestamp)}
                </Text>
                <span class={levelChipClass(entry.level)}>{entry.level}</span>
                <Show when={entry.prefix}>{(prefix) => <span class={prefixChipClass}>[{prefix()}]</span>}</Show>
                <Text fontSize="sm" flex="1" truncate textAlign="left" class={rowTitleClass}>
                  {entry.summary}
                </Text>
                <Tooltip
                  portalled={false}
                  contentProps={props.tooltipContentProps}
                  content={
                    props.copiedRowId() === entry.id ? "Copied row JSON" : "Copy this row JSON"
                  }
                  showArrow
                >
                  <IconButton
                    class="log-row-copy"
                    size="xs"
                    variant="plain"
                    color="fg.subtle"
                    aria-label="Copy this row JSON"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onCopyEntry(entry);
                    }}
                  >
                    <Show when={props.copiedRowId() === entry.id} fallback={<CopyIcon size={12} />}>
                      <CheckIcon size={12} />
                    </Show>
                  </IconButton>
                </Tooltip>
              </HStack>
              <Show when={expanded()}>
                <Box as="pre" class={detailsClass}>
                  {entry.details}
                </Box>
              </Show>
            </Box>
          );
        }}
      </For>
    </Stack>
  );
};
