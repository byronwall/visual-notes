import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { SidePanel } from "~/components/SidePanel";
import { CloseButton } from "~/components/ui/close-button";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import {
  clearConsoleLogEntries,
  consoleLogCaptureEnabled,
  consoleLogCaptureMaxEntries,
  consoleLogEntries,
  setConsoleLogCaptureEnabled,
  setConsoleLogCaptureMaxEntries,
  type ConsoleCaptureEntry,
} from "~/lib/console-log-capture";
import { ConsoleLogsList } from "./console-logs/ConsoleLogsList";
import { ConsolePrefixFilters } from "./console-logs/ConsolePrefixFilters";
import { ConsoleLogsTopControls } from "./console-logs/ConsoleLogsTopControls";
import { tooltipContentProps } from "./console-logs/consoleLogPanel.styles";
import {
  buildDownloadFilename,
  buildPrefixesText,
  buildSingleEntryJson,
  buildVisibleJson,
  parseBoundedInt,
} from "./console-logs/consoleLogPanel.utils";

type ConsoleLogsPanelProps = {
  open: boolean;
  onClose: () => void;
};

export const ConsoleLogsPanel = (props: ConsoleLogsPanelProps) => {
  const [prefixFilter, setPrefixFilter] = createSignal<string>("all");
  const [expandedIds, setExpandedIds] = createSignal<Set<number>>(new Set<number>());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [maxKeepInput, setMaxKeepInput] = createSignal("1000");
  const [rowLimitInput, setRowLimitInput] = createSignal("200");
  const [samplePerPrefix, setSamplePerPrefix] = createSignal(false);
  const [copiedVisible, setCopiedVisible] = createSignal(false);
  const [copiedPrefixes, setCopiedPrefixes] = createSignal(false);
  const [copiedRowId, setCopiedRowId] = createSignal<number | null>(null);

  const rowLimit = createMemo(() => parseBoundedInt(rowLimitInput(), 200, 1, 5_000));

  const applyMaxKeep = () => {
    const next = parseBoundedInt(maxKeepInput(), consoleLogCaptureMaxEntries(), 1, 10_000);
    setConsoleLogCaptureMaxEntries(next);
    setMaxKeepInput(String(next));
  };

  const normalizeRowLimitInput = () => {
    const next = parseBoundedInt(rowLimitInput(), 200, 1, 5_000);
    setRowLimitInput(String(next));
  };

  createEffect(() => {
    setMaxKeepInput(String(consoleLogCaptureMaxEntries()));
  });

  const prefixCounts = createMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of consoleLogEntries()) {
      const key = entry.prefix || "untyped";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });

  const prefixes = createMemo(() => {
    const list = [...prefixCounts().keys()].filter((key) => key !== "untyped");
    list.sort((a, b) => a.localeCompare(b));
    return list;
  });

  const filteredEntries = createMemo(() => {
    const filter = prefixFilter();
    if (filter === "all") return consoleLogEntries();
    if (filter === "untyped") return consoleLogEntries().filter((entry) => !entry.prefix);
    return consoleLogEntries().filter((entry) => entry.prefix === filter);
  });

  createEffect(() => {
    const current = prefixFilter();
    const hasCurrent = current === "all" || current === "untyped" || prefixes().includes(current);
    if (!hasCurrent) setPrefixFilter("all");
  });

  createEffect(() => {
    if (!props.open) setExpandedIds(new Set<number>());
  });

  const visibleEntries = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return filteredEntries();
    return filteredEntries().filter((entry) => {
      const haystack = `${entry.summary}\n${entry.details}\n${entry.prefix ?? ""}\n${entry.level}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  const displayedEntries = createMemo(() => {
    const limit = rowLimit();
    const list = visibleEntries();
    if (!samplePerPrefix()) return list.slice(0, limit);

    const usedByPrefix = new Map<string, number>();
    const sampled: ConsoleCaptureEntry[] = [];
    for (const entry of list) {
      const key = entry.prefix ?? "untyped";
      const used = usedByPrefix.get(key) ?? 0;
      if (used >= limit) continue;
      usedByPrefix.set(key, used + 1);
      sampled.push(entry);
    }
    return sampled;
  });

  const visiblePrefixCounts = createMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of displayedEntries()) {
      const key = entry.prefix ?? "untyped";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  });

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async (value: string) => {
    if (typeof window === "undefined") return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  const copyVisibleLogs = async () => {
    const payload = buildVisibleJson(displayedEntries(), prefixFilter(), searchQuery());
    const ok = await copyText(payload);
    if (!ok) return;
    setCopiedVisible(true);
    window.setTimeout(() => setCopiedVisible(false), 1200);
  };

  const copyVisiblePrefixes = async () => {
    const rows = visiblePrefixCounts();
    if (rows.length === 0) return;
    const payload = buildPrefixesText(rows, displayedEntries().length);
    const ok = await copyText(payload);
    if (!ok) return;
    setCopiedPrefixes(true);
    window.setTimeout(() => setCopiedPrefixes(false), 1200);
  };

  const copySingleEntry = async (entry: ConsoleCaptureEntry) => {
    const ok = await copyText(buildSingleEntryJson(entry));
    if (!ok) return;
    setCopiedRowId(entry.id);
    window.setTimeout(() => {
      setCopiedRowId((prev) => (prev === entry.id ? null : prev));
    }, 1200);
  };

  const downloadVisibleLogs = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([buildVisibleJson(displayedEntries(), prefixFilter(), searchQuery())], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = buildDownloadFilename(prefixFilter());
    window.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const emitTestLogs = () => {
    const stamp = new Date().toISOString();
    const testErr = new Error("Simulated test error for log panel");

    console.log(`[test] plain message @ ${stamp}`);
    console.info("[api] request", { method: "GET", path: "/api/docs", ms: 87 });
    console.warn("[auth] token expiring soon", { userId: "u_123", inSeconds: 45 });
    console.error("[db] failed query", { code: "P2025", retryable: false, error: testErr });
    console.debug("[vite] hmr", { file: "/src/components/ConsoleLogsPanel.tsx" });
    console.trace("[trace] stack sample from ConsoleLogsPanel");
    console.table([
      { service: "search", status: "ok", ms: 41 },
      { service: "index", status: "degraded", ms: 212 },
    ]);
    console.log("[metrics] counters", { cacheHit: 31, cacheMiss: 7, ratio: 0.815 });
    console.log("[selection] ids", ["a12", "a14", "b02"]);
    console.log("[render] nested", {
      widget: "console-panel",
      options: { dense: true, monospace: true },
    });
    console.info("No prefix entry for untyped filter");
    console.warn("[feature-flag] toggles", { logPanel: true, debugCapture: true });
    console.error("[network] timeout", { endpoint: "/api/docs", timeoutMs: 5000 });
  };

  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      ariaLabel="Console log panel"
      width="min(96vw, 820px)"
    >
      <Stack h="full" minH="0" gap="0" fontFamily="mono" position="relative">
        <Box position="absolute" top="2.5" right="4" zIndex="1">
          <Tooltip
            portalled={false}
            contentProps={tooltipContentProps}
            content="Close panel"
            showArrow
          >
            <CloseButton size="xs" onClick={props.onClose} />
          </Tooltip>
        </Box>

        <Stack px="4" py="2.5" gap="2" borderBottomWidth="1px" borderColor="border">
          <Text fontSize="xs" color="fg.muted">
            Captures browser console output with prefix filters and expandable row details.
          </Text>

          <ConsoleLogsTopControls
            tooltipContentProps={tooltipContentProps}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            maxKeepInput={maxKeepInput}
            setMaxKeepInput={setMaxKeepInput}
            applyMaxKeep={applyMaxKeep}
            rowLimitInput={rowLimitInput}
            setRowLimitInput={setRowLimitInput}
            normalizeRowLimitInput={normalizeRowLimitInput}
            samplePerPrefix={samplePerPrefix}
            setSamplePerPrefix={setSamplePerPrefix}
            captureEnabled={consoleLogCaptureEnabled}
            onToggleCapture={() => setConsoleLogCaptureEnabled(!consoleLogCaptureEnabled())}
            onClear={clearConsoleLogEntries}
            clearDisabled={() => consoleLogEntries().length === 0}
            onEmitTestLogs={emitTestLogs}
            onCopyPrefixes={() => void copyVisiblePrefixes()}
            copyPrefixesDisabled={() => visiblePrefixCounts().length === 0}
            copiedPrefixes={copiedPrefixes}
            onDownloadVisible={downloadVisibleLogs}
            onCopyVisible={() => void copyVisibleLogs()}
            visibleActionsDisabled={() => displayedEntries().length === 0}
            copiedVisible={copiedVisible}
          />

          <ConsolePrefixFilters
            tooltipContentProps={tooltipContentProps}
            prefixFilter={prefixFilter}
            setPrefixFilter={setPrefixFilter}
            prefixes={prefixes}
            prefixCounts={prefixCounts}
            displayedCount={() => displayedEntries().length}
            overflowDeps={() => displayedEntries().length}
          />
        </Stack>

        <Box flex="1" minH="0" overflowY="auto" px="4" py="2.5">
          <Show
            when={consoleLogCaptureEnabled()}
            fallback={
              <Box
                borderWidth="1px"
                borderColor="black.a3"
                borderRadius="l2"
                p="3"
                bg="bg.subtle"
              >
                <Text fontSize="sm" color="fg.default">
                  Capture is off. Turn it on to start recording console output.
                </Text>
              </Box>
            }
          >
            <Show
              when={displayedEntries().length > 0}
              fallback={
                <Box
                  borderWidth="1px"
                  borderColor="black.a3"
                  borderRadius="l2"
                  p="3"
                  bg="bg.subtle"
                >
                  <Text fontSize="sm" color="fg.muted">
                    No logs match this filter/search.
                  </Text>
                </Box>
              }
            >
              <ConsoleLogsList
                entries={displayedEntries}
                expandedIds={expandedIds}
                onToggleExpanded={toggleExpanded}
                copiedRowId={copiedRowId}
                onCopyEntry={(entry) => {
                  void copySingleEntry(entry);
                }}
                tooltipContentProps={tooltipContentProps}
              />
            </Show>
          </Show>
        </Box>
      </Stack>
    </SidePanel>
  );
};
