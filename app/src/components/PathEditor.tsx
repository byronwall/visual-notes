import { For, Show, Suspense, createEffect, createMemo, createSignal } from "solid-js";
import type { VoidComponent } from "solid-js";
import { createAsync, useAction } from "@solidjs/router";
import { CircleXIcon } from "lucide-solid";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { fetchPathSuggestions, updateDoc } from "~/services/docs.service";

type PathCount = { path: string; count: number };
type PathDraft = { committed: string[]; current: string };

const parsePath = (raw?: string): PathDraft => {
  const incoming = (raw || "").trim();
  if (!incoming) return { committed: [], current: "" };

  const tokens = incoming.split(".").filter((token) => token.length > 0);
  if (tokens.length <= 1) {
    return { committed: [], current: tokens[0] || "" };
  }

  return {
    committed: tokens.slice(0, -1),
    current: tokens[tokens.length - 1] || "",
  };
};

const serializePath = (draft: PathDraft) => {
  const parts = [...draft.committed];
  if (draft.current.length > 0) parts.push(draft.current);
  return parts.join(".");
};

const buildNextSegmentSuggestions = (
  items: PathCount[],
  committed: string[],
  current: string
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [] as { seg: string; count: number }[];
  }

  const typed = current.trim();
  const counts = new Map<string, number>();

  if (committed.length === 0) {
    for (const item of items) {
      const tokens = item.path.split(".");
      const segment = tokens[0] || "";
      if (!segment) continue;
      if (typed && !segment.startsWith(typed)) continue;
      counts.set(segment, (counts.get(segment) || 0) + item.count);
    }
  } else {
    const base = `${committed.join(".")}.`;
    for (const item of items) {
      if (!item.path.startsWith(base)) continue;
      const tokens = item.path.split(".");
      const segment = tokens[committed.length] || "";
      if (!segment) continue;
      if (typed && !segment.startsWith(typed)) continue;
      counts.set(segment, (counts.get(segment) || 0) + item.count);
    }
  }

  return Array.from(counts.entries())
    .map(([seg, count]) => ({ seg, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
};

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
}> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  let lastAppliedInitialPath = (props.initialPath || "").trim();

  const [draft, setDraft] = createSignal<PathDraft>(parsePath(props.initialPath));
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isFocused, setIsFocused] = createSignal(false);

  const runUpdateDoc = useAction(updateDoc);
  const pathCounts = createAsync(() => fetchPathSuggestions());

  createEffect(() => {
    const incoming = (props.initialPath || "").trim();
    if (incoming === lastAppliedInitialPath) return;
    lastAppliedInitialPath = incoming;
    setDraft(parsePath(incoming));
  });

  createEffect(() => {
    const value = serializePath(draft());
    if (props.onChange) props.onChange(value);
  });

  const nextSegmentSuggestions = createMemo(() =>
    buildNextSegmentSuggestions(pathCounts() || [], draft().committed, draft().current)
  );

  const commitCurrentSegment = () => {
    const currentValue = draft().current.trim();
    if (!currentValue) return;

    setDraft((prev) => ({
      committed: [...prev.committed, currentValue],
      current: "",
    }));
  };

  const handleSelectSuggestion = (segment: string) => {
    setDraft((prev) => ({
      committed: [...prev.committed, segment],
      current: "",
    }));
    if (inputRef) inputRef.focus();
  };

  const handleBackspace = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace") return;

    const state = draft();
    if (state.current.length > 0) return;
    if (state.committed.length === 0) return;

    const nextCommitted = state.committed.slice(0, -1);
    const lastSegment = state.committed[state.committed.length - 1] || "";
    setDraft({ committed: nextCommitted, current: lastSegment });
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ".") {
      ev.preventDefault();
      commitCurrentSegment();
      return;
    }

    if (ev.key === "Enter") {
      ev.preventDefault();
      commitCurrentSegment();
      if (inputRef) inputRef.blur();
      return;
    }

    if (ev.key === "Escape") {
      ev.preventDefault();
      if (inputRef) inputRef.blur();
    }
  };

  const handleSave = async () => {
    if (!props.docId) return;

    const finalPath = serializePath(draft()).trim();
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
    const state = draft();
    if (index < 0 || index >= state.committed.length) return;
    setDraft({ committed: state.committed.slice(0, index + 1), current: "" });
    if (inputRef) inputRef.focus();
  };

  const clearAll = async () => {
    if (props.docId) {
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level."
      );
      if (!confirmed) return;
    }

    setDraft({ committed: [], current: "" });
    setIsFocused(false);
    await handleSave();
  };

  const handleEditorFocusOut = (ev: FocusEvent) => {
    const next = ev.relatedTarget;
    const currentTarget = ev.currentTarget as HTMLElement | null;
    if (next instanceof Node && currentTarget?.contains(next)) return;
    setIsFocused(false);
  };

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
            <Show when={draft().committed.length === 0 && draft().current.length === 0}>
              <Text fontSize="sm" color="fg.subtle">
                e.g. work.projects.alpha
              </Text>
            </Show>

            <For each={draft().committed}>
              {(segment, i) => (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    borderRadius="full"
                    title={segment}
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
                      {segment}
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
              value={draft().current}
              onInput={(e) =>
                setDraft((prev) => ({ ...prev, current: e.currentTarget.value }))
              }
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

          <Show when={isFocused()}>
            <Box
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              p="2.5"
              bg="bg.default"
            >
              <Text fontSize="xs" color="fg.muted" mb="0.5rem">
                <Show
                  when={draft().committed.length === 0}
                  fallback={
                    <Text as="span">
                      Next after{" "}
                      <Text as="span" fontWeight="semibold">
                        {draft().committed.join(".")}
                      </Text>
                    </Text>
                  }
                >
                  <Text as="span">Popular top-level segments</Text>
                </Show>
              </Text>
              <Text fontSize="xs" color="fg.muted" mb="1.5">
                Hit <Text as="span" fontFamily="mono">.</Text> to nest
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
