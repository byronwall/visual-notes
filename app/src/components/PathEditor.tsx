import {
  For,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { fetchPathSuggestions, updateDocPath } from "~/services/docs.service";
import { Popover } from "./Popover";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { CircleXIcon } from "lucide-solid";

// TODO: this needs a `disabled` prop to disable the editor

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
}> = (props) => {
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isOpen, setIsOpen] = createSignal(false);
  let anchorRef: HTMLDivElement | undefined;

  // Load all existing paths with counts once
  const [pathCounts] = createResource(fetchPathSuggestions);

  // Internal representation: committed segments + current editable segment
  const splitInitial = () => {
    const raw = (props.initialPath || "").trim();
    if (!raw) return { committed: [] as string[], current: "" };
    const tokens = raw.split(".").filter((t) => t.length > 0);
    if (tokens.length <= 1) return { committed: [], current: tokens[0] || "" };
    return {
      committed: tokens.slice(0, -1),
      current: tokens[tokens.length - 1] || "",
    };
  };

  const [committed, setCommitted] = createSignal<string[]>(
    splitInitial().committed
  );
  const [current, setCurrent] = createSignal<string>(splitInitial().current);

  const joinedPath = createMemo(() => {
    const parts = [...committed()];
    if (current().length > 0) parts.push(current());
    return parts.join(".");
  });

  // Sync internal state only when external initialPath changes
  // Important: do NOT depend on joinedPath() here, or typing will be reset
  createEffect(() => {
    const incoming = (props.initialPath || "").trim();
    if (!incoming) {
      setCommitted([]);
      setCurrent("");
      return;
    }
    const tokens = incoming.split(".").filter((t) => t.length > 0);
    if (tokens.length <= 1) {
      setCommitted([]);
      setCurrent(tokens[0] || "");
    } else {
      setCommitted(tokens.slice(0, -1));
      setCurrent(tokens[tokens.length - 1] || "");
    }
  });

  createEffect(() => {
    const value = joinedPath();
    console.log(`[PathEditor] path=${value}`);
    if (props.onChange) props.onChange(value);
  });

  // Build next-segment suggestions based on counts
  type PathCount = { path: string; count: number };
  const allPathCounts = createMemo<PathCount[]>(() => pathCounts() || []);

  const nextSegmentSuggestions = createMemo(() => {
    const data = allPathCounts();
    if (!Array.isArray(data) || data.length === 0)
      return [] as { seg: string; count: number }[];
    const prefixSegments = committed();
    const typed = current().trim();
    const counts = new Map<string, number>();

    if (prefixSegments.length === 0) {
      for (const item of data) {
        const t = item.path.split(".");
        const seg = t[0] || "";
        if (!seg) continue;
        if (typed && !seg.startsWith(typed)) continue;
        counts.set(seg, (counts.get(seg) || 0) + item.count);
      }
    } else {
      const base = prefixSegments.join(".") + ".";
      for (const item of data) {
        if (!item.path.startsWith(base)) continue;
        const t = item.path.split(".");
        const seg = t[prefixSegments.length] || "";
        if (!seg) continue;
        if (typed && !seg.startsWith(typed)) continue;
        counts.set(seg, (counts.get(seg) || 0) + item.count);
      }
    }
    const list = Array.from(counts.entries())
      .map(([seg, count]) => ({ seg, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    return list;
  });

  const handleFocusInput = () => {
    setIsOpen(true);
  };

  const handleOutsideClose = () => {
    setIsOpen(false);
  };

  const commitCurrentSegment = () => {
    const value = current().trim();
    if (!value) return;
    setCommitted((prev) => [...prev, value]);
    setCurrent("");
  };

  const handleSelectSuggestion = (seg: string) => {
    console.log("[PathEditor] select seg", seg);
    setCurrent(seg);
    // Immediately commit chosen segment to move to the next level
    commitCurrentSegment();
    setIsOpen(true);
  };

  const handleBackspace = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace") return;
    if (current().length > 0) return;
    const prev = committed();
    if (prev.length === 0) return;
    const next = prev.slice(0, -1);
    const last = prev[prev.length - 1] || "";
    setCommitted(next);
    setCurrent(last);
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ".") {
      ev.preventDefault();
      commitCurrentSegment();
      setIsOpen(true);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      // finalize current segment
      commitCurrentSegment();
      setIsOpen(false);
      return;
    }
  };

  const handleSave = async () => {
    if (!props.docId) return;
    const finalPath = joinedPath().trim();
    setSaving(true);
    setError(undefined);
    try {
      await updateDocPath(props.docId, finalPath);
    } catch (e) {
      setError((e as Error).message || "Failed to save path");
    } finally {
      setSaving(false);
    }
  };

  const onWindowKeyDown = (ev: KeyboardEvent) => {
    if (!isOpen()) return;
    if (ev.key === "Escape") setIsOpen(false);
  };
  createEffect(() => {
    window.addEventListener("keydown", onWindowKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onWindowKeyDown));
  });

  const truncateTo = (index: number) => () => {
    const parts = committed();
    if (index < 0 || index >= parts.length) return;
    const next = parts.slice(0, index + 1);
    setCommitted(next);
    setCurrent("");
    setIsOpen(true);
  };

  const clearAll = async () => {
    if (props.docId) {
      // only confirm if we have a docId -- cannot save otherwise
      // TODO: this logic should really be in one place.
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level."
      );
      if (!confirmed) return;
    }
    console.log("[PathEditor] clear -> saving empty path");
    setCommitted([]);
    setCurrent("");
    setIsOpen(false);
    await handleSave();
  };

  return (
    <HStack gap="0.5rem" align="center">
      <Box flex="1" minW="0" ref={(el) => (anchorRef = el)}>
        <Box
          borderWidth="1px"
          borderColor="gray.outline.border"
          borderRadius="l2"
          px="0.5rem"
          py="0.25rem"
          fontSize="sm"
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gap="0.25rem"
          minH="32px"
          cursor="text"
          onClick={() => {
            const input = document.getElementById(
              "path-editor-input"
            ) as HTMLInputElement | null;
            if (input) {
              input.focus();
              setIsOpen(true);
            }
          }}
        >
          <Show when={committed().length === 0 && current().length === 0}>
            <Text fontSize="sm" color="black.a6">
              e.g. work.projects.alpha
            </Text>
          </Show>
          <For each={committed()}>
            {(seg, i) => (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  borderRadius="full"
                  title={seg}
                  onClick={truncateTo(i())}
                >
                  <Text
                    as="span"
                    fontWeight="semibold"
                    maxW="10rem"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {seg}
                  </Text>
                </Button>
                <Text fontSize="sm" color="black.a6">
                  .
                </Text>
              </>
            )}
          </For>

          <Box
            as="input"
            id="path-editor-input"
            flex="1"
            minW="8ch"
            outline="none"
            fontSize="sm"
            bg="transparent"
            border="none"
            value={current()}
            onInput={(e) =>
              setCurrent((e.currentTarget as HTMLInputElement).value)
            }
            onFocus={handleFocusInput}
            onKeyDown={(e) => {
              handleKeyDown(e as unknown as KeyboardEvent);
              handleBackspace(e as unknown as KeyboardEvent);
            }}
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
        </Box>

        <Show when={error()}>
          {(e) => (
            <Text fontSize="xs" color="red.11" mt="0.25rem">
              {e()}
            </Text>
          )}
        </Show>

        <Suspense fallback={null}>
          <Popover
            open={isOpen()}
            onClose={handleOutsideClose}
            anchorEl={anchorRef}
            placement="bottom-start"
            style={{ width: "90%", maxWidth: "28rem", padding: "0.75rem" }}
          >
            <Text fontSize="xs" color="black.a7" mb="0.5rem">
              <Show
                when={committed().length === 0}
                fallback={
                  <Text as="span">
                    Next after{" "}
                    <Text as="span" fontWeight="semibold">
                      {committed().join(".")}
                    </Text>
                  </Text>
                }
              >
                <Text as="span">Popular top-level segments</Text>
              </Show>
            </Text>
            <Text fontSize="xs" color="black.a7" mb="0.5rem">
              Hit <Text as="span" fontFamily="mono">.</Text> to nest
            </Text>
            <HStack gap="0.5rem" flexWrap="wrap">
              <For each={nextSegmentSuggestions()}>
                {(s) => (
                  <Button
                    size="xs"
                    variant="outline"
                    borderRadius="full"
                    onClick={() => handleSelectSuggestion(s.seg)}
                    title={`${s.seg} (${s.count})`}
                  >
                    <Text
                      as="span"
                      fontWeight="semibold"
                      maxW="12rem"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {s.seg}
                    </Text>
                    <Text as="span" color="black.a7">
                      {s.count}
                    </Text>
                  </Button>
                )}
              </For>
            </HStack>
            <Show when={nextSegmentSuggestions().length === 0}>
              <Text fontSize="xs" color="black.a7" mt="0.5rem">
                No suggestions
              </Text>
            </Show>
          </Popover>
        </Suspense>
      </Box>

      <Show when={props.docId}>
        <Button
          size="xs"
          variant="outline"
          loading={saving()}
          loadingText="Saving…"
          onClick={handleSave}
          disabled={saving()}
        >
          Save
        </Button>
      </Show>
      <IconButton
        size="xs"
        variant="plain"
        onClick={clearAll}
        title="Clear path"
        aria-label="Clear path"
        type="button"
      >
        <CircleXIcon />
      </IconButton>
    </HStack>
  );
};
