import {
  For,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import type { JSX, VoidComponent } from "solid-js";
import { createAsync } from "@solidjs/router";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ClearButton } from "~/components/ui/clear-button";
import {
  appendSegment,
  buildNextSegmentSuggestions,
  clearPathDraft,
  commitCurrentSegment,
  normalizeCurrentSegment,
  parsePersistedPathDraft,
  popSegmentIntoCurrent,
  serializePathDraft,
  setCurrentSegment,
  truncatePathDraft,
  type PathDraft,
} from "~/components/doc-properties/path-draft";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { fetchPathSuggestions } from "~/services/docs.service";
import { useNoteMutations } from "~/hooks/useNoteMutations";

export const PathEditor: VoidComponent<{
  docId?: string;
  initialPath?: string;
  onChange?: (path: string) => void;
  onChangeWhenSavedOnly?: boolean;
  /** Enter on an empty segment finished the edit. */
  onSubmit?: () => void;
  actions?: JSX.Element;
}> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  // Seed with the mounted doc so the sync effect's first run is not treated as
  // a doc switch; that run can land after the user starts typing and would
  // wipe the in-progress segment.
  let lastAppliedDocId = props.docId;
  let lastAppliedInitialPath = (props.initialPath || "").trim();
  let saveVersion = 0;

  const [draft, setDraft] = createSignal<PathDraft>(
    parsePersistedPathDraft(props.initialPath),
  );
  const [pendingDocIds, setPendingDocIds] = createSignal<Set<string>>(
    new Set(),
  );
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [isFocused, setIsFocused] = createSignal(false);

  const { update: runUpdateDoc } = useNoteMutations();
  const pathCounts = createAsync(() => fetchPathSuggestions());

  createEffect(() => {
    const incomingDocId = props.docId;
    const incoming = (props.initialPath || "").trim();
    const docChanged = incomingDocId !== lastAppliedDocId;
    if (
      incomingDocId === lastAppliedDocId &&
      incoming === lastAppliedInitialPath
    ) {
      return;
    }
    const previousInitialPath = lastAppliedInitialPath;
    lastAppliedDocId = incomingDocId;
    lastAppliedInitialPath = incoming;
    if (docChanged) {
      saveVersion += 1;
      setError(undefined);
    } else {
      const current = serializePathDraft(draft()).trim();
      if (incoming === current) return;
      // Keep a draft the user changed since the last saved path. A late save
      // or a live refresh of the same note must not wipe what they are typing.
      if (current !== previousInitialPath) return;
    }
    setDraft(parsePersistedPathDraft(incoming));
    setIsFocused(false);
  });

  createEffect(() => {
    const shouldEmitDraftChange = !props.onChangeWhenSavedOnly || !props.docId;
    if (!shouldEmitDraftChange) return;
    const value = serializePathDraft(draft());
    if (props.onChange) props.onChange(value);
  });

  const nextSegmentSuggestions = createMemo(() =>
    buildNextSegmentSuggestions(
      pathCounts() || [],
      draft().committed,
      draft().current,
    ),
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
    const docId = props.docId;
    if (!docId) return false;
    if (pendingDocIds().has(docId)) return false;
    const version = ++saveVersion;
    setPendingDocIds((current) => new Set(current).add(docId));
    setError(undefined);
    try {
      await runUpdateDoc({ id: docId, path });
      if (
        props.docId === docId &&
        version === saveVersion &&
        serializePathDraft(draft()).trim() === path &&
        props.onChange &&
        props.onChangeWhenSavedOnly
      ) {
        props.onChange(path);
      }
      return true;
    } catch (e) {
      if (props.docId === docId && version === saveVersion) {
        setError((e as Error).message || "Failed to save path");
      }
      return false;
    } finally {
      setPendingDocIds((current) => {
        const next = new Set(current);
        next.delete(docId);
        return next;
      });
    }
  };

  const isSavingCurrentDoc = () =>
    !!props.docId && pendingDocIds().has(props.docId);

  const handleSelectSuggestion = async (segment: string) => {
    if (isSavingCurrentDoc()) return;
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
      if (draft().current.trim())
        setDraft((prev) => commitCurrentSegment(prev));
      else void handleSubmit();
      return;
    }

    if (ev.key === "Escape") {
      ev.preventDefault();
      if (inputRef) inputRef.blur();
    }
  };

  const handleSave = async () => {
    if (isSavingCurrentDoc()) return;
    const nextDraft = updateDraft(normalizeCurrentSegment);
    await savePath(serializePathDraft(nextDraft).trim());
  };

  const handleSubmit = async () => {
    if (isSavingCurrentDoc()) return;
    const path = serializePathDraft(draft()).trim();
    const changed = path !== (props.initialPath || "").trim();
    if (props.docId && changed && !(await savePath(path))) return;
    props.onSubmit?.();
  };

  const handleTruncate = (index: number) => {
    if (isSavingCurrentDoc()) return;
    const nextDraft = updateDraft((prev) => truncatePathDraft(prev, index));
    void savePath(serializePathDraft(nextDraft).trim());
    if (inputRef) inputRef.focus();
  };

  const clearAll = async () => {
    if (isSavingCurrentDoc()) return;
    if (props.docId) {
      const confirmed = window.confirm(
        "Clear the path and save it as empty? This will reset the path to the base level.",
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
    <Stack gap="2" onFocusOut={handleEditorFocusOut}>
      <Suspense fallback={null}>
        <Stack gap="2" onFocusIn={() => setIsFocused(true)}>
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
                    disabled={isSavingCurrentDoc()}
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
              data-path-segment-input="true"
              _focus={{ borderColor: "transparent", boxShadow: "none" }}
              _focusVisible={{ outline: "none", boxShadow: "none" }}
              value={draft().current}
              onInput={(e) =>
                setDraft((prev) =>
                  setCurrentSegment(prev, e.currentTarget.value),
                )
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
                Pick a child to continue nesting, or type a segment and hit{" "}
                <Text as="span" fontFamily="mono">
                  .
                </Text>
              </Text>

              <Box maxH="12rem" overflowY="auto">
                <HStack gap="0.5rem" flexWrap="wrap" alignItems="flex-start">
                  <For each={nextSegmentSuggestions()}>
                    {(s) => (
                      <Button
                        size="xs"
                        variant="outline"
                        borderRadius="full"
                        disabled={isSavingCurrentDoc()}
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
        <ClearButton
          onClick={clearAll}
          label="Clear path"
          disabled={isSavingCurrentDoc()}
        />
        {props.actions}

        <Show when={props.docId}>
          <Button
            size="xs"
            variant="outline"
            loading={isSavingCurrentDoc()}
            loadingText="Saving…"
            onClick={handleSave}
            disabled={isSavingCurrentDoc()}
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
