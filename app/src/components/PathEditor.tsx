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
    const value = serializePathDraft(draft());
    if (props.onChange) props.onChange(value);
  });

  const nextSegmentSuggestions = createMemo(() =>
    buildNextSegmentSuggestions(pathCounts() || [], draft().committed, draft().current)
  );

  const handleSelectSuggestion = (segment: string) => {
    setDraft((prev) => appendSegment(prev, segment));
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
    if (!props.docId) return;

    const finalPath = serializePathDraft(draft()).trim();
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
    setDraft((prev) => truncatePathDraft(prev, index));
    if (inputRef) inputRef.focus();
  };

  const clearAll = async () => {
    if (props.docId) {
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level."
      );
      if (!confirmed) return;
    }

    setDraft(clearPathDraft());
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
