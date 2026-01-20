import { useNavigate } from "@solidjs/router";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  splitProps,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { useAbortableFetch } from "~/features/docs-index/hooks/useAbortableFetch";
import {
  searchDocs,
  type ServerSearchItem,
} from "~/features/docs-index/data/docs.service";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";

type CommandKMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNewNote: (initialTitle: string | undefined) => void;
};

type CommandItem =
  | {
      kind: "action";
      key: string;
      label: string;
      hint?: string;
      run: () => void;
    }
  | {
      kind: "doc";
      key: string;
      title: string;
      path?: string | null;
      snippet?: string | null;
      run: () => void;
    };

type HighlightedTextProps = {
  text: string;
  query: string;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightedTextWrapClass = css({
  display: "inline",
});

const highlightMarkClass = css({
  display: "inline",
  borderRadius: "sm",
  px: "0.5",
  bg: "yellow.3",
  color: "black",
});

const NewNoteIcon: VoidComponent<{ size?: number }> = (props) => {
  const size = () => props.size ?? 16;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      class={css({ color: "fg.muted", flexShrink: "0" })}
    >
      <path
        d="M12 6v12M6 12h12"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
};

const HighlightedText: VoidComponent<HighlightedTextProps> = (props) => {
  const [local] = splitProps(props, ["text", "query"]);

  const qTokens = () =>
    local.query
      .trim()
      .split(/\s+/g)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 6);

  const parts = createMemo(() => {
    const text = local.text;
    const tokens = qTokens();
    if (!text.length) return [{ kind: "text" as const, value: "" }];
    if (tokens.length === 0) return [{ kind: "text" as const, value: text }];

    const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
    const out: Array<{ kind: "text" | "match"; value: string }> = [];
    let lastIdx = 0;

    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      const raw = m[0] ?? "";
      if (!raw) continue;
      if (idx > lastIdx) out.push({ kind: "text", value: text.slice(lastIdx, idx) });
      out.push({ kind: "match", value: text.slice(idx, idx + raw.length) });
      lastIdx = idx + raw.length;
    }

    if (lastIdx < text.length) out.push({ kind: "text", value: text.slice(lastIdx) });
    if (out.length === 0) return [{ kind: "text" as const, value: text }];
    return out;
  });

  return (
    <Box as="span" class={highlightedTextWrapClass}>
      <For each={parts()}>
        {(p) => (
          <Show
            when={p.kind === "match"}
            fallback={<Box as="span">{p.value}</Box>}
          >
            <Box as="mark" class={highlightMarkClass}>
              {p.value}
            </Box>
          </Show>
        )}
      </For>
    </Box>
  );
};

export const CommandKMenu: VoidComponent<CommandKMenuProps> = (props) => {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [debouncedQuery, setDebouncedQuery] = createSignal("");
  let inputEl: HTMLInputElement | undefined;

  const qTrim = () => query().trim();
  const qForSearch = () => (qTrim().length >= 2 ? qTrim() : "");

  const { withAbort, abort } = useAbortableFetch();

  const snippetClass = css({
    fontSize: "xs",
    color: "black.a7",
    lineClamp: "2",
    mt: "0.1rem",
  });
  const secondaryRowClass = css({
    fontSize: "xs",
    color: "black.a7",
    mt: "0.1rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });

  let debounceTimer: number | undefined;
  createEffect(() => {
    const q = qForSearch();
    if (debounceTimer) window.clearTimeout(debounceTimer);

    if (!q) {
      setDebouncedQuery("");
      abort();
      return;
    }

    debounceTimer = window.setTimeout(() => {
      setDebouncedQuery(q);
    }, 250);

    onCleanup(() => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
    });
  });

  const [results] = createResource(debouncedQuery, (q) => {
    if (!q) return Promise.resolve([] as ServerSearchItem[]);
    return withAbort((signal) => searchDocs({ q, take: 25, signal }));
  });

  const close = () => {
    props.onOpenChange(false);
  };

  const handleCreateNewNote = () => {
    const title = qTrim();
    console.log("[cmdk] new note", { title });
    close();
    props.onCreateNewNote(title.length > 0 ? title : undefined);
  };

  const handleOpenDoc = (id: string) => {
    console.log("[cmdk] open doc", id);
    close();
    navigate(`/docs/${id}`);
  };

  const items = createMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        kind: "action",
        key: "new-note",
        label: "New note",
        hint: qTrim().length ? `Title: “${qTrim()}”` : undefined,
        run: handleCreateNewNote,
      },
    ];

    // Use `latest` to avoid Suspense re-triggering (UI flashing) on each query change.
    const hits = (results.latest || []) as ServerSearchItem[];
    const mapped: CommandItem[] = hits.slice(0, 10).map((d) => ({
      kind: "doc",
      key: d.id,
      title: d.title,
      path: d.path,
      snippet: d.snippet,
      run: () => handleOpenDoc(d.id),
    }));

    return [...base, ...mapped];
  });

  const clampSelected = (next: number) => {
    const max = Math.max(0, items().length - 1);
    return Math.max(0, Math.min(max, next));
  };

  const moveSelected = (delta: number) => {
    setSelectedIndex((prev) => clampSelected(prev + delta));
  };

  const runSelected = () => {
    const it = items()[clampSelected(selectedIndex())];
    if (!it) return;
    it.run();
  };

  const handleInputKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveSelected(1);
      return;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveSelected(-1);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      runSelected();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
      return;
    }
  };

  createEffect(() => {
    if (!props.open) {
      setQuery("");
      setSelectedIndex(0);
      abort();
      return;
    }
    setSelectedIndex(0);
    window.setTimeout(() => inputEl?.focus(), 0);
  });

  createEffect(() => {
    // When query changes, snap selection back to the top.
    // This keeps the "New note" action easy to hit via Enter.
    void query();
    setSelectedIndex(0);
  });

  const isSearchingEnabled = () => qTrim().length >= 2;
  const isSearching = () => isSearchingEnabled() && results.loading;

  const rowBg = (active: boolean) => (active ? "black.a2" : "transparent");

  const formatSnippet = (s: string | null | undefined) => {
    const raw = (s ?? "").trim();
    if (!raw) return undefined;
    return raw.replace(/\s+/g, " ");
  };

  const resultsPanelHeight = "55vh";
  const hitsLatest = () => (results.latest || []) as ServerSearchItem[];

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Command"
      description="Create a note or search your notes"
      maxW="720px"
    >
      <Stack gap="0.75rem" w="full" minW="0">
        <Box w="full" minW="0">
          <HStack gap="2" alignItems="center">
            <Box flex="1" minW="0">
              <Input
                ref={inputEl}
                size="sm"
                placeholder="Type to search… (2+ characters)"
                value={query()}
                onInput={(e) =>
                  setQuery((e.currentTarget as HTMLInputElement).value)
                }
                onKeyDown={(e) =>
                  handleInputKeyDown(e as unknown as KeyboardEvent)
                }
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
              />
            </Box>

            {/* reserve space to avoid layout shift */}
            <Box w="20px" display="inline-flex" justifyContent="flex-end">
              <Show when={isSearching()}>
                <Spinner size="xs" color="fg.muted" />
              </Show>
            </Box>
          </HStack>
        </Box>

        <Suspense
          fallback={
            <Box
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              h={resultsPanelHeight}
              overflowY="auto"
              w="full"
              minW="0"
            >
              <Box px="0.75rem" py="0.6rem">
                <Text fontSize="sm" color="black.a7">
                  Loading…
                </Text>
              </Box>
            </Box>
          }
        >
          <Box
            borderWidth="1px"
            borderColor="gray.outline.border"
            borderRadius="l2"
            h={resultsPanelHeight}
            overflowY="auto"
            w="full"
            minW="0"
          >
            <Stack gap="0">
              <For each={items()}>
                {(it, idx) => (
                  <Button
                    variant={idx() === selectedIndex() ? "subtle" : "plain"}
                    size="sm"
                    w="full"
                    h="auto"
                    px="0.75rem"
                    py="0.6rem"
                    borderRadius="0"
                    borderBottomWidth="1px"
                    borderColor="gray.outline.border"
                    bg={rowBg(idx() === selectedIndex())}
                    display="flex"
                    flexDirection="column"
                    alignItems="stretch"
                    justifyContent="flex-start"
                    textAlign="left"
                    minW="0"
                    onMouseEnter={() => setSelectedIndex(idx())}
                    onClick={it.run}
                  >
                    <Switch>
                      <Match when={it.kind === "action"}>
                        <HStack gap="2" alignItems="center" minW="0">
                          <Show
                            when={
                              (it as Extract<CommandItem, { kind: "action" }>)
                                .key === "new-note"
                            }
                          >
                            <NewNoteIcon />
                          </Show>
                          <Box minW="0" flex="1">
                            <Text fontSize="sm" fontWeight="semibold" truncate>
                              {
                                (it as Extract<CommandItem, { kind: "action" }>)
                                  .label
                              }
                            </Text>
                          </Box>
                        </HStack>
                        <Show
                          when={
                            (it as Extract<CommandItem, { kind: "action" }>)
                              .hint
                          }
                        >
                          {(hint) => (
                            <Box class={secondaryRowClass}>{hint()}</Box>
                          )}
                        </Show>
                      </Match>
                      <Match when={it.kind === "doc"}>
                        <Text fontSize="sm" fontWeight="semibold" truncate>
                          <HighlightedText
                            text={(it as Extract<CommandItem, { kind: "doc" }>).title}
                            query={qTrim()}
                          />
                        </Text>
                        <Show
                          when={
                            (it as Extract<CommandItem, { kind: "doc" }>).path
                          }
                        >
                          {(path) => (
                            <Box class={secondaryRowClass}>
                              <HighlightedText text={path()} query={qTrim()} />
                            </Box>
                          )}
                        </Show>
                        <Show
                          when={formatSnippet(
                            (it as Extract<CommandItem, { kind: "doc" }>)
                              .snippet
                          )}
                        >
                          {(snippet) => (
                            <Box class={snippetClass}>
                              <HighlightedText text={snippet()} query={qTrim()} />
                            </Box>
                          )}
                        </Show>
                      </Match>
                    </Switch>
                  </Button>
                )}
              </For>

              <Show
                when={
                  isSearchingEnabled() &&
                  debouncedQuery().length > 0 &&
                  !results.loading &&
                  hitsLatest().length === 0
                }
              >
                <Box px="0.75rem" py="0.6rem">
                  <Text fontSize="sm" color="black.a7">
                    No results.
                  </Text>
                </Box>
              </Show>
            </Stack>
          </Box>
        </Suspense>
      </Stack>
    </SimpleDialog>
  );
};
