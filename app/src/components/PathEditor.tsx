import {
  For,
  Show,
  Suspense,
  batch,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import type { VoidComponent } from "solid-js";
import { createAsync, useAction } from "@solidjs/router";
import { fetchPathSuggestions, updateDoc } from "~/services/docs.service";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Box, HStack, Stack } from "styled-system/jsx";
import { CircleXIcon } from "lucide-solid";

// TODO: this needs a `disabled` prop to disable the editor

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
}> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isFocused, setIsFocused] = createSignal(false);
  const runUpdateDoc = useAction(updateDoc);

  // Load all existing paths with counts once
  const pathCounts = createAsync(() => fetchPathSuggestions());

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
  let lastAppliedInitialPath = (props.initialPath || "").trim();

  const joinedPath = createMemo(() => {
    const parts = [...committed()];
    if (current().length > 0) parts.push(current());
    return parts.join(".");
  });

  // Sync internal state only when external initialPath changes
  // Important: do NOT depend on joinedPath() here, or typing will be reset
  createEffect(() => {
    const incoming = (props.initialPath || "").trim();
    console.log("[PathEditor] sync-check", {
      incoming,
      lastAppliedInitialPath,
    });
    if (incoming === lastAppliedInitialPath) return;
    console.log("[PathEditor] sync-apply", {
      from: lastAppliedInitialPath,
      to: incoming,
    });
    lastAppliedInitialPath = incoming;
    if (!incoming) {
      batch(() => {
        setCommitted([]);
        setCurrent("");
      });
      return;
    }
    const tokens = incoming.split(".").filter((t) => t.length > 0);
    if (tokens.length <= 1) {
      batch(() => {
        setCommitted([]);
        setCurrent(tokens[0] || "");
      });
    } else {
      batch(() => {
        setCommitted(tokens.slice(0, -1));
        setCurrent(tokens[tokens.length - 1] || "");
      });
    }
  });

  createEffect(() => {
    const value = joinedPath();
    console.log("[PathEditor] path-change", {
      value,
      committed: committed(),
      current: current(),
      propInitialPath: (props.initialPath || "").trim(),
      lastAppliedInitialPath,
    });
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

  const commitCurrentSegment = () => {
    const value = current().trim();
    if (!value) return;
    batch(() => {
      setCommitted((prev) => [...prev, value]);
      setCurrent("");
    });
  };

  const handleSelectSuggestion = (seg: string) => {
    console.log("[PathEditor] select seg", seg);
    batch(() => {
      setCommitted((prev) => [...prev, seg]);
      setCurrent("");
    });
    if (inputRef) inputRef.focus();
  };

  const handleBackspace = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace") return;
    if (current().length > 0) return;
    const prev = committed();
    if (prev.length === 0) return;
    const next = prev.slice(0, -1);
    const last = prev[prev.length - 1] || "";
    batch(() => {
      setCommitted(next);
      setCurrent(last);
    });
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ".") {
      ev.preventDefault();
      commitCurrentSegment();
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      // finalize current segment
      commitCurrentSegment();
      if (inputRef) inputRef.blur();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (inputRef) inputRef.blur();
      return;
    }
  };

  const handleSave = async () => {
    if (!props.docId) return;
    const finalPath = joinedPath().trim();
    setSaving(true);
    setError(undefined);
    try {
      await runUpdateDoc({ id: props.docId, path: finalPath });
    } catch (e) {
      setError((e as Error).message || "Failed to save path");
    } finally {
      setSaving(false);
    }
  };

  const truncateTo = (index: number) => () => {
    const parts = committed();
    if (index < 0 || index >= parts.length) return;
    const next = parts.slice(0, index + 1);
    batch(() => {
      setCommitted(next);
      setCurrent("");
    });
    if (inputRef) inputRef.focus();
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
    batch(() => {
      setCommitted([]);
      setCurrent("");
      setIsFocused(false);
    });
    await handleSave();
  };

  const handleEditorFocusOut = (ev: FocusEvent) => {
    const next = ev.relatedTarget;
    const currentTarget = ev.currentTarget as HTMLElement | null;
    if (next instanceof Node && currentTarget?.contains(next)) return;
    setIsFocused(false);
  };

  const showSuggestions = createMemo(() => {
    if (!isFocused()) return false;
    return true;
  });

  return (
    <Stack gap="2">
      <Suspense fallback={null}>
        <Stack
          gap="2"
          onFocusIn={() => setIsFocused(true)}
          onFocusOut={handleEditorFocusOut}
        >
          <Box
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l2"
            px="0.75rem"
            py="0.5rem"
            fontSize="sm"
            display="flex"
            flexWrap="wrap"
            alignItems="center"
            gap="0.25rem"
            minH="40px"
            cursor="text"
            onClick={() => {
              if (inputRef) inputRef.focus();
            }}
          >
            <Show when={committed().length === 0 && current().length === 0}>
              <Text fontSize="sm" color="fg.subtle">
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
                  <Text fontSize="sm" color="fg.subtle">
                    .
                  </Text>
                </>
              )}
            </For>

            <Input
              ref={inputRef}
              variant="flushed"
              size="xs"
              flex="1"
              minW="10ch"
              bg="transparent"
              value={current()}
              onInput={(e) => setCurrent(e.currentTarget.value)}
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

          <Show when={showSuggestions()}>
            <Box
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              p="2.5"
              bg="bg.default"
            >
              <Text fontSize="xs" color="fg.muted" mb="0.5rem">
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
              <Text fontSize="xs" color="fg.muted" mb="1.5">
                Hit{" "}
                <Text as="span" fontFamily="mono">
                  .
                </Text>{" "}
                to nest
              </Text>
              <Box maxH="12rem" overflowY="auto">
                <HStack gap="0.5rem" flexWrap="wrap" alignItems="flex-start">
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
                        <Text as="span" color="fg.muted">
                          {s.count}
                        </Text>
                      </Button>
                    )}
                  </For>
                </HStack>
              </Box>
              <Show when={nextSegmentSuggestions().length === 0}>
                <Text fontSize="xs" color="fg.muted" mt="0.5rem">
                  No suggestions
                </Text>
              </Show>
            </Box>
          </Show>
        </Stack>
      </Suspense>

      <HStack justifyContent="flex-end" gap="1.5" alignItems="center">
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
      </HStack>

      <Show when={error()}>
        {(e) => (
          <Text fontSize="xs" color="red.11">
            {e()}
          </Text>
        )}
      </Show>
    </Stack>
  );
};
