import { useNavigate } from "@solidjs/router";
import {
  For,
  Match,
  onMount,
  Show,
  Suspense,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  type VoidComponent,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
import type { SimpleSelectItem } from "~/components/ui/simple-select";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  fetchDocs,
  searchDocs,
  type DocListItem,
  type ServerSearchItem,
} from "~/features/docs-index/data/docs.service";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { ActivityIcon, ArrowUpDownIcon } from "lucide-solid";

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
      href: string;
      title: string;
      path?: string | null;
      snippet?: string | null;
      run: () => void;
    };

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

export const CommandKMenu: VoidComponent<CommandKMenuProps> = (props) => {
  const navigate = useNavigate();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [debouncedQuery, setDebouncedQuery] = createSignal("");
  const [selectsReady, setSelectsReady] = createSignal(false);
  const [sortMode, setSortMode] = createSignal<
    "relevance" | "recent_activity" | "most_viewed_30d" | "most_edited_30d"
  >("relevance");
  const [activityClass, setActivityClass] = createSignal<
    "" | "READ_HEAVY" | "EDIT_HEAVY" | "BALANCED" | "COLD"
  >("");
  let inputEl: HTMLInputElement | undefined;

  onMount(() => {
    setSelectsReady(true);
  });

  const qTrim = () => query().trim();
  const qForSearch = () => (qTrim().length >= 2 ? qTrim() : "");

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
  const docRowClass = (active: boolean) =>
    css({
      padding: "0.6rem 0.75rem",
      borderBottomWidth: "1px",
      borderColor: "gray.outline.border",
      background: rowBg(active),
      transition: "background 120ms ease",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      textAlign: "left",
      minWidth: "0",
      color: "fg.default",
      textDecorationLine: "none",
      _hover: {
        textDecorationLine: "none",
        background: active ? "black.a2" : "black.a1",
      },
    });

  let debounceTimer: number | undefined;
  createEffect(() => {
    const q = qForSearch();
    if (debounceTimer) window.clearTimeout(debounceTimer);

    if (!q) {
      setDebouncedQuery("");
      return;
    }

    debounceTimer = window.setTimeout(() => {
      setDebouncedQuery(q);
    }, 250);

    onCleanup(() => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
    });
  });

  const searchParams = createMemo(() => ({
    q: debouncedQuery(),
    sortMode: sortMode(),
    activityClass: activityClass(),
  }));

  const [results] = createResource(searchParams, async (params) => {
    if (params.q) {
      return searchDocs({
        q: params.q,
        take: 25,
        sortMode: params.sortMode,
        activityClass: params.activityClass || undefined,
      });
    }

    // Empty-state feed: show likely next docs to open, activity-aware.
    const emptySortMode =
      params.sortMode === "relevance" ? "recent_activity" : params.sortMode;
    const docs = await fetchDocs({
      take: 25,
      sortMode: emptySortMode,
      activityClass: params.activityClass || undefined,
    });
    return docs.map((doc: DocListItem): ServerSearchItem => ({
      ...doc,
      snippet: undefined,
    }));
  });

  const close = () => {
    props.onOpenChange(false);
  };

  const handleCreateNewNote = () => {
    const title = qTrim();
    close();
    props.onCreateNewNote(title.length > 0 ? title : undefined);
  };

  const handleOpenDoc = (id: string) => {
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
      href: `/docs/${d.id}`,
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
      setSortMode("relevance");
      setActivityClass("");
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
  const isSearching = () => results.loading;

  const rowBg = (active: boolean) => (active ? "black.a2" : "transparent");
  const sortModeItems: SimpleSelectItem[] = [
    { label: "Relevance", value: "relevance" },
    { label: "Recent activity", value: "recent_activity" },
    { label: "Most viewed (30d)", value: "most_viewed_30d" },
    { label: "Most edited (30d)", value: "most_edited_30d" },
  ];
  const activityClassItems: SimpleSelectItem[] = [
    { label: "All activity", value: "" },
    { label: "Read-heavy", value: "READ_HEAVY" },
    { label: "Edit-heavy", value: "EDIT_HEAVY" },
    { label: "Balanced", value: "BALANCED" },
    { label: "Cold", value: "COLD" },
  ];

  const formatSnippet = (s: string | null | undefined) => {
    const raw = (s ?? "").trim();
    if (!raw) return undefined;
    return raw.replace(/\s+/g, " ");
  };

  const resultsPanelHeight = "55vh";
  const hitsLatest = () => (results.latest || []) as ServerSearchItem[];
  const handleDocLinkClick = (ev: MouseEvent, id: string) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    handleOpenDoc(id);
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      maxW="720px"
    >
      <Stack gap="0.5rem" w="full" minW="0">
        <HStack gap="2" alignItems="center" w="full" minW="0">
          <Input
            ref={inputEl}
            size="sm"
            flex="1"
            minW="0"
            placeholder="Type to search… (2+ characters)"
            value={query()}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => handleInputKeyDown(e as unknown as KeyboardEvent)}
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />

          <HStack gap="2" alignItems="center" flexShrink="0" ml="auto">
            <Show when={isSearching()}>
              <Spinner size="xs" color="fg.muted" />
            </Show>
            <Show
              when={selectsReady()}
              fallback={
                <HStack gap="2" alignItems="center" flexShrink="0">
                  <Text fontSize="xs" color="black.a7" whiteSpace="nowrap">
                    {sortModeItems.find((item) => item.value === sortMode())
                      ?.label ?? "Relevance"}
                  </Text>
                  <Text fontSize="xs" color="black.a7" whiteSpace="nowrap">
                    {activityClassItems.find(
                      (item) => item.value === activityClass(),
                    )?.label ?? "All activity"}
                  </Text>
                </HStack>
              }
            >
              <HStack gap="2" alignItems="center" flexShrink="0">
                <HStack gap="1" alignItems="center">
                  <ArrowUpDownIcon size={14} />
                  <SimpleSelect
                    items={sortModeItems}
                    value={sortMode()}
                    onChange={(value) =>
                      setSortMode(
                        value as
                          | "relevance"
                          | "recent_activity"
                          | "most_viewed_30d"
                          | "most_edited_30d",
                      )
                    }
                    size="sm"
                    sameWidth
                    skipPortal
                  />
                </HStack>
                <HStack gap="1" alignItems="center">
                  <ActivityIcon size={14} />
                  <SimpleSelect
                    items={activityClassItems}
                    value={activityClass()}
                    onChange={(value) =>
                      setActivityClass(
                        value as
                          | ""
                          | "READ_HEAVY"
                          | "EDIT_HEAVY"
                          | "BALANCED"
                          | "COLD",
                      )
                    }
                    size="sm"
                    sameWidth
                    skipPortal
                  />
                </HStack>
              </HStack>
            </Show>
          </HStack>
        </HStack>

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
                  <Switch>
                    <Match when={it.kind === "action"}>
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
                        <HStack gap="2" alignItems="center" minW="0">
                          <Show
                            when={
                              (it as Extract<CommandItem, { kind: "action" }>)
                                .key === "new-note"
                            }
                          >
                            <NewNoteIcon />
                          </Show>
                          <Text fontSize="sm" fontWeight="semibold" truncate minW="0" flex="1">
                            {(it as Extract<CommandItem, { kind: "action" }>).label}
                          </Text>
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
                      </Button>
                    </Match>
                    <Match when={it.kind === "doc"}>
                      <a
                        href={(it as Extract<CommandItem, { kind: "doc" }>).href}
                        class={docRowClass(idx() === selectedIndex())}
                        onMouseEnter={() => setSelectedIndex(idx())}
                        onClick={(e) =>
                          handleDocLinkClick(
                            e as unknown as MouseEvent,
                            (it as Extract<CommandItem, { kind: "doc" }>).key,
                          )
                        }
                      >
                        <Text fontSize="sm" fontWeight="semibold" truncate>
                          {renderHighlighted(
                            (it as Extract<CommandItem, { kind: "doc" }>).title,
                            qTrim()
                          )}
                        </Text>
                        <Show
                          when={
                            (it as Extract<CommandItem, { kind: "doc" }>).path
                          }
                        >
                          {(path) => (
                            <Box class={secondaryRowClass}>
                              {renderHighlighted(path(), qTrim())}
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
                              {renderHighlighted(snippet(), qTrim())}
                            </Box>
                          )}
                        </Show>
                      </a>
                    </Match>
                  </Switch>
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
