import { For, Show, Suspense, createEffect, createMemo, createSignal } from "solid-js";
import type { VoidComponent } from "solid-js";
import { createAsync, useAction } from "@solidjs/router";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ClearButton } from "~/components/ui/clear-button";
import {
  appendSegment,
  buildNextSegmentSuggestions,
  clearPathDraft,
  commitCurrentSegment,
  parsePathDraft,
  popSegmentIntoCurrent,
  serializePathDraft,
  setCurrentSegment,
  truncatePathDraft,
  type PathDraft,
} from "~/components/doc-properties/path-draft";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { fetchPathSuggestions, updateDoc } from "~/services/docs.service";

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
  onChangeWhenSavedOnly?: boolean;
}> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  let lastAppliedInitialPath = (props.initialPath || "").trim();

  const [draft, setDraft] = createSignal<PathDraft>(parsePathDraft(props.initialPath));
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isFocused, setIsFocused] = createSignal(false);

  const runUpdateDoc = useAction(updateDoc);
  const pathCounts = createAsync(() => fetchPathSuggestions());

  createEffect(() => {
    const incoming = (props.initialPath || "").trim();
    if (incoming === lastAppliedInitialPath) return;
    lastAppliedInitialPath = incoming;
    setDraft(parsePathDraft(incoming));
  });

  createEffect(() => {
    const shouldEmitDraftChange = !props.onChangeWhenSavedOnly || !props.docId;
    if (!shouldEmitDraftChange) return;
    const value = serializePathDraft(draft());
    if (props.onChange) props.onChange(value);
  });

  const nextSegmentSuggestions = createMemo(() =>
    buildNextSegmentSuggestions(pathCounts() || [], draft().committed, draft().current)
  );

  const updateDraft = (updater: (prev: PathDraft) => PathDraft): PathDraft => {
    let nextDraft!: PathDraft;
    setDraft((prev) => {
      nextDraft = updater(prev);
      return nextDraft;
    });
    return nextDraft;
  };

  const savePath = async (path: string) => {
    if (!props.docId) return;
    setSaving(true);
    setError(undefined);
    try {
      await runUpdateDoc({ id: props.docId, path });
      if (props.onChange && props.onChangeWhenSavedOnly) {
        props.onChange(path);
      }
    } catch (e) {
      setError((e as Error).message || "Failed to save path");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSuggestion = async (segment: string) => {
    const nextDraft = updateDraft((prev) => appendSegment(prev, segment));
    await savePath(serializePathDraft(nextDraft).trim());
    if (inputRef) inputRef.focus();
  };

  const handleBackspace = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace") return;
    setDraft((prev) => popSegmentIntoCurrent(prev));
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ".") {
      ev.preventDefault();
      setDraft((prev) => commitCurrentSegment(prev));
      return;
    }

    if (ev.key === "Enter") {
      ev.preventDefault();
      setDraft((prev) => commitCurrentSegment(prev));
      if (inputRef) inputRef.blur();
      return;
    }

    if (ev.key === "Escape") {
      ev.preventDefault();
      if (inputRef) inputRef.blur();
    }
  };

  const handleSave = async () => {
    await savePath(serializePathDraft(draft()).trim());
  };

  const handleTruncate = (index: number) => {
    const nextDraft = updateDraft((prev) => truncatePathDraft(prev, index));
    void savePath(serializePathDraft(nextDraft).trim());
    if (inputRef) inputRef.focus();
  };

  const clearAll = async () => {
    if (props.docId) {
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level."
      );
      if (!confirmed) return;
    }

    const nextDraft = updateDraft(() => clearPathDraft());
    setIsFocused(false);
    await savePath(serializePathDraft(nextDraft).trim());
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
            <For each={draft().committed}>
              {(segment, i) => (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    borderRadius="full"
                    title={segment}
                    onClick={() => handleTruncate(i())}
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
              variant="outline"
              size="xs"
              flex="1"
              minW="10ch"
              h="auto"
              minH="0"
              px="0"
              borderWidth="0"
              borderColor="transparent"
              bg="transparent"
              placeholder="e.g. work.projects.alpha"
              _focus={{ borderColor: "transparent", boxShadow: "none" }}
              _focusVisible={{ outline: "none", boxShadow: "none" }}
              value={draft().current}
              onInput={(e) =>
                setDraft((prev) => setCurrentSegment(prev, e.currentTarget.value))
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
              borderRadius="l2"
              p="2.5"
              bg="gray.subtle.bg"
              onMouseDown={(e) => {
                // Keep suggestion panel visible when clicking non-interactive space.
                e.preventDefault();
                if (inputRef) inputRef.focus();
              }}
            >
              <Text fontSize="xs" color="fg.muted" mb="1.5">
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
                        onClick={() => void handleSelectSuggestion(s.seg)}
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
        <ClearButton onClick={clearAll} label="Clear path" />

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
