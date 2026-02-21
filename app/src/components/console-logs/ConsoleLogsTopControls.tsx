import { CheckIcon, CopyIcon, DownloadIcon, ListIcon } from "lucide-solid";
import { Show, type Accessor } from "solid-js";
import { HStack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Tooltip } from "~/components/ui/tooltip";

type ConsoleLogsTopControlsProps = {
  tooltipContentProps: { zIndex: "tooltip" };
  searchQuery: Accessor<string>;
  setSearchQuery: (next: string) => void;
  maxKeepInput: Accessor<string>;
  setMaxKeepInput: (next: string) => void;
  applyMaxKeep: () => void;
  rowLimitInput: Accessor<string>;
  setRowLimitInput: (next: string) => void;
  normalizeRowLimitInput: () => void;
  samplePerPrefix: Accessor<boolean>;
  setSamplePerPrefix: (next: boolean) => void;
  captureEnabled: Accessor<boolean>;
  onToggleCapture: () => void;
  onClear: () => void;
  clearDisabled: Accessor<boolean>;
  onEmitTestLogs: () => void;
  onCopyPrefixes: () => void;
  copyPrefixesDisabled: Accessor<boolean>;
  copiedPrefixes: Accessor<boolean>;
  onDownloadVisible: () => void;
  onCopyVisible: () => void;
  visibleActionsDisabled: Accessor<boolean>;
  copiedVisible: Accessor<boolean>;
};

export const ConsoleLogsTopControls = (props: ConsoleLogsTopControlsProps) => {
  return (
    <HStack gap="2" flexWrap="wrap">
      <Input
        size="xs"
        value={props.searchQuery()}
        onInput={(event) => props.setSearchQuery((event.currentTarget as HTMLInputElement).value)}
        placeholder="Search visible logs..."
        fontFamily="mono"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck={false}
        w={{ base: "full", sm: "280px" }}
      />

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content="Maximum logs retained in memory"
        showArrow
      >
        <Input
          size="xs"
          value={props.maxKeepInput()}
          onInput={(event) => props.setMaxKeepInput((event.currentTarget as HTMLInputElement).value)}
          onBlur={props.applyMaxKeep}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            props.applyMaxKeep();
          }}
          placeholder="Max keep"
          fontFamily="mono"
          inputMode="numeric"
          w="7.5rem"
        />
      </Tooltip>

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content="Rows to show in the list"
        showArrow
      >
        <Input
          size="xs"
          value={props.rowLimitInput()}
          onInput={(event) => props.setRowLimitInput((event.currentTarget as HTMLInputElement).value)}
          onBlur={props.normalizeRowLimitInput}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            props.normalizeRowLimitInput();
          }}
          placeholder="Row limit"
          fontFamily="mono"
          inputMode="numeric"
          w="7.5rem"
        />
      </Tooltip>

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content="Apply row limit per prefix using most recent rows"
        showArrow
      >
        <Checkbox.Root
          checked={props.samplePerPrefix()}
          onCheckedChange={(details) => props.setSamplePerPrefix(details.checked === true)}
        >
          <Checkbox.HiddenInput />
          <HStack gap="1" px="1.5">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label fontSize="xs" color="fg.muted">
              sample prefixes
            </Checkbox.Label>
          </HStack>
        </Checkbox.Root>
      </Tooltip>

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content={props.captureEnabled() ? "Disable console capture" : "Enable console capture"}
        showArrow
      >
        <Button
          size="xs"
          variant={props.captureEnabled() ? "subtle" : "outline"}
          onClick={props.onToggleCapture}
          fontFamily="mono"
        >
          {props.captureEnabled() ? "Capture On" : "Capture Off"}
        </Button>
      </Tooltip>

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content="Clear captured logs"
        showArrow
      >
        <Button
          size="xs"
          variant="outline"
          onClick={props.onClear}
          disabled={props.clearDisabled()}
          fontFamily="mono"
        >
          Clear
        </Button>
      </Tooltip>

      <Tooltip
        portalled={false}
        contentProps={props.tooltipContentProps}
        content="Emit mixed test logs for previewing rendering"
        showArrow
      >
        <Button
          size="xs"
          variant="outline"
          onClick={props.onEmitTestLogs}
          fontFamily="mono"
        >
          Test Logs
        </Button>
      </Tooltip>

      <HStack gap="1">
        <Tooltip
          portalled={false}
          contentProps={props.tooltipContentProps}
          content={
            props.copiedPrefixes()
              ? "Copied visible prefixes"
              : "Copy visible prefixes with counts"
          }
          showArrow
        >
          <IconButton
            size="xs"
            variant="outline"
            aria-label="Copy visible prefixes with counts"
            onClick={() => props.onCopyPrefixes()}
            disabled={props.copyPrefixesDisabled()}
          >
            <Show when={props.copiedPrefixes()} fallback={<ListIcon size={12} />}>
              <CheckIcon size={12} />
            </Show>
          </IconButton>
        </Tooltip>

        <Tooltip
          portalled={false}
          contentProps={props.tooltipContentProps}
          content="Download visible logs as JSON"
          showArrow
        >
          <IconButton
            size="xs"
            variant="outline"
            aria-label="Download visible logs as JSON"
            onClick={props.onDownloadVisible}
            disabled={props.visibleActionsDisabled()}
          >
            <DownloadIcon size={12} />
          </IconButton>
        </Tooltip>

        <Tooltip
          portalled={false}
          contentProps={props.tooltipContentProps}
          content={props.copiedVisible() ? "Copied visible logs" : "Copy visible logs JSON"}
          showArrow
        >
          <IconButton
            size="xs"
            variant="outline"
            aria-label="Copy visible logs JSON"
            onClick={() => props.onCopyVisible()}
            disabled={props.visibleActionsDisabled()}
          >
            <Show when={props.copiedVisible()} fallback={<CopyIcon size={12} />}>
              <CheckIcon size={12} />
            </Show>
          </IconButton>
        </Tooltip>
      </HStack>
    </HStack>
  );
};
