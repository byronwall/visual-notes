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
  commandSearchKey,
  loadCommandResults,
  retryCommandResults,
  type CommandSearchParams,
} from "~/components/command-search";
import { fetchPathSuggestions } from "~/services/docs.service";
import { renderHighlighted } from "~/features/docs-index/utils/highlight";
import { pathToRoute } from "~/utils/path-links";
import {
  PaletteActionRow,
  PaletteGroupLabel,
  PaletteNavRow,
} from "~/components/command-palette/PaletteRows";
import { PalettePathChips } from "~/components/command-palette/PalettePathChips";
import * as Dialog from "~/components/ui/dialog";
import { ActivityIcon, ArrowUpDownIcon, DatabaseIcon, XIcon } from "lucide-solid";
import { fetchCollections } from "~/services/collections/collections.queries";
import {
  matchActions,
  matchDestinations,
  type PaletteAction,
  type PaletteIcon,
} from "~/components/command-palette/palette-commands";
import { ALL_DESTINATIONS } from "~/components/sidebar/nav-items";

type CommandKMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNewNote: (initialTitle: string | undefined) => void;
  /** Shell-level commands (chat, sidebar, logs) matched by name while typing. */
  actions?: PaletteAction[];
};

type CommandGroup = "Actions" | "Go to" | "Notes" | "Recent";

type CommandItem =
  | {
      kind: "action";
      group: CommandGroup;
      key: string;
      label: string;
      hint?: string;
      shortcut?: string;
      icon?: PaletteIcon;
      run: () => void;
    }
  | {
      kind: "nav";
      group: CommandGroup;
      key: string;
      href: string;
      label: string;
      icon: PaletteIcon;
      run: () => void;
    }
  | {
      kind: "doc";
      group: CommandGroup;
      key: string;
      href: string;
      title: string;
      path?: string | null;
      snippet?: string | null;
      run: () => void;
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
  let resultsViewportEl: HTMLDivElement | undefined;

  onMount(() => {
    setSelectsReady(true);
  });

  const qTrim = () => query().trim();
  const qForSearch = () => qTrim();

  const snippetClass = css({
    fontSize: "xs",
    color: "fg.muted",
    lineClamp: "2",
    mt: "0.1rem",
  });
  const secondaryRowClass = css({
    fontSize: "xs",
    fontFamily: "mono",
    color: "fg.muted",
    mt: "0.1rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  const docRowClass = (active: boolean) =>
    css({
      padding: "0.5rem 0.75rem",
      borderRadius: "l2",
      background: rowBg(active),
      transitionProperty: "background-color",
      transitionDuration: "120ms",
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
        background: active ? "gray.a3" : "gray.a2",
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

  const searchParams = createMemo<CommandSearchParams>(() => ({
    q: debouncedQuery(),
    sortMode: sortMode(),
    activityClass: activityClass(),
  }));

  const [results, { refetch: retrySearch }] = createResource(
    searchParams,
    async (params) => {
      console.debug("[cmdk.search] request", {
        q: params.q,
        sortMode: params.sortMode,
        activityClass: params.activityClass,
      });
      return loadCommandResults(params);
    },
  );
  createEffect(() => {
    const latest = results.latest;
    console.debug("[cmdk.search] response", {
      q: debouncedQuery(),
      resultCount: latest?.items.length ?? 0,
      failed: latest?.failed ?? false,
      topResultsPreview: (latest?.items ?? []).slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
      })),
    });
  });
  // Collections are destinations too: "reading" jumps to the Reading collection.
  const [collections] = createResource(
    () => props.open,
    async (isOpen) => (isOpen ? fetchCollections() : []),
  );
  const [allPathSuggestions] = createResource(() => props.open, async (isOpen) => {
    if (!isOpen) return [];
    return fetchPathSuggestions();
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

  const currentResults = () => {
    const latest = results.latest;
    const currentKey = commandSearchKey({
      q: qForSearch(),
      sortMode: sortMode(),
      activityClass: activityClass(),
    });
    return latest?.key === currentKey ? latest : undefined;
  };

  const items = createMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        kind: "action",
        group: "Actions",
        key: "new-note",
        label: qTrim().length ? `New note “${qTrim()}”` : "New note",
        shortcut: "⌘D",
        run: handleCreateNewNote,
      },
    ];
    const q = qTrim();
    const actionHits: CommandItem[] = matchActions(q, props.actions ?? []).map(
      (action) => ({
        kind: "action",
        group: "Actions",
        key: `action:${action.key}`,
        label: action.label,
        shortcut: action.shortcut,
        icon: action.icon,
        run: () => {
          close();
          action.run();
        },
      }),
    );
    const collectionDestinations = (collections.latest ?? []).map((c) => ({
      label: c.name,
      href: `/collections/${c.id}`,
      icon: DatabaseIcon,
      keywords: "collection database",
    }));
    const navHits: CommandItem[] = matchDestinations(q, [
      ...ALL_DESTINATIONS,
      ...collectionDestinations,
    ]).map(
      (dest) => ({
        kind: "nav",
        group: "Go to",
        key: `nav:${dest.href}`,
        href: dest.href,
        label: dest.label,
        icon: dest.icon,
        run: () => {
          close();
          navigate(dest.href);
        },
      }),
    );

    // Use `latest` to avoid Suspense re-triggering (UI flashing) on each query change.
    const hits = currentResults()?.items ?? [];
    const docGroup: CommandGroup = q ? "Notes" : "Recent";
    const mapped: CommandItem[] = hits.slice(0, 10).map((d) => ({
      kind: "doc",
      group: docGroup,
      key: d.id,
      href: `/docs/${d.id}`,
      title: d.title,
      path: d.path,
      snippet: d.snippet,
      run: () => handleOpenDoc(d.id),
    }));

    return [...base, ...actionHits, ...navHits, ...mapped];
  });

  const clampSelected = (next: number) => {
    const max = Math.max(0, items().length - 1);
    return Math.max(0, Math.min(max, next));
  };

  const resetSelection = () => {
    setSelectedIndex(0);
    if (resultsViewportEl) resultsViewportEl.scrollTop = 0;
  };

  const scrollSelectedIntoView = () => {
    resultsViewportEl
      ?.querySelector<HTMLElement>(`[data-command-index="${selectedIndex()}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  };

  const moveSelected = (delta: number) => {
    setSelectedIndex((prev) => clampSelected(prev + delta));
    scrollSelectedIntoView();
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
      setSelectedIndex(0);
      setSortMode("relevance");
      setActivityClass("");
      return;
    }
    setSelectedIndex(0);
    window.setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 0);
  });

  createEffect(() => {
    // Keep the New note action visible and selected when the query changes.
    void query();
    resetSelection();
  });

  const isSearchingEnabled = () => qForSearch().length > 0;
  const isSearching = () => results.loading;

  const rowBg = (active: boolean) => (active ? "gray.a3" : "transparent");
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
  const matchingPaths = createMemo(() => {
    const q = qTrim().toLowerCase();
    const all = (allPathSuggestions.latest || []) as { path: string; count: number }[];
    if (!q) return all.slice(0, 8);

    const tokens = q
      .split(/[.\s/\\_-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (tokens.length === 0) return all.slice(0, 8);

    const scored = all
      .filter((item) => {
        const path = item.path.toLowerCase();
        const segments = path.split(".");
        return (
          path.includes(q) ||
          tokens.every((token) => segments.some((segment) => segment.includes(token)))
        );
      })
      .map((item) => {
        const path = item.path.toLowerCase();
        const startsWith = path.startsWith(q);
        const includes = path.includes(q);
        return {
          ...item,
          score: startsWith ? 3 : includes ? 2 : 1,
        };
      })
      .sort(
        (a, b) => b.score - a.score || b.count - a.count || a.path.localeCompare(b.path),
      )
      .slice(0, 8)
      .map(({ path, count }) => ({ path, count }));
    return scored;
  });
  // The close button takes its own column so it can't sit over the selects;
  // below sm the selects drop to a second row and the input keeps its width.
  const headerClass = css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gridTemplateAreas: '"input controls close"',
    alignItems: "center",
    columnGap: "2",
    rowGap: "2",
    w: "full",
    minW: "0",
    smDown: {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"input close" "controls controls"',
    },
  });
  const closeClass = css({
    gridArea: "close",
    position: "static",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    w: "8",
    h: "8",
    borderRadius: "l2",
    color: "fg.muted",
    cursor: "pointer",
    transitionProperty: "background-color, color",
    transitionDuration: "140ms",
    _hover: { bg: "gray.a2", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "gray.a8" },
  });

  const resultsPanelHeight = "55vh";
  const hitsLatest = () => currentResults()?.items ?? [];
  const handleDocLinkClick = (ev: MouseEvent, id: string) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    handleOpenDoc(id);
  };
  const handleNavLinkClick = (ev: MouseEvent, href: string) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    close();
    navigate(href);
  };
  const handlePathLinkClick = (ev: MouseEvent, path: string) => {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    close();
    navigate(pathToRoute(path));
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      maxW="720px"
      showClose={false}
    >
      <Stack gap="0.5rem" w="full" minW="0">
        <Box class={headerClass}>
          <Input
            ref={inputEl}
            size="sm"
            gridArea="input"
            minW="0"
            placeholder="Search notes, sections, and actions…"
            aria-label="Search"
            value={query()}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => handleInputKeyDown(e as unknown as KeyboardEvent)}
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />

          <HStack gap="2" alignItems="center" minW="0" gridArea="controls">
            <Show when={isSearching()}>
              <Spinner size="xs" color="fg.muted" />
            </Show>
            <Show
              when={selectsReady()}
              fallback={
                <HStack gap="2" alignItems="center" flexShrink="0">
                  <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                    {sortModeItems.find((item) => item.value === sortMode())
                      ?.label ?? "Relevance"}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
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
                    onChange={(value) => {
                      const next = value as
                        | "relevance"
                        | "recent_activity"
                        | "most_viewed_30d"
                        | "most_edited_30d";
                      if (next !== sortMode()) {
                        resetSelection();
                      }
                      setSortMode(next);
                    }}
                    size="sm"
                    sameWidth
                    skipPortal
                  />
                </HStack>
                <HStack gap="1" alignItems="center">
                  <ActivityIcon size={14} />
                  <SimpleSelect
                    items={activityClassItems}
                    placeholder="All activity"
                    value={activityClass()}
                    onChange={(value) => {
                      const next = value as
                        | ""
                        | "READ_HEAVY"
                        | "EDIT_HEAVY"
                        | "BALANCED"
                        | "COLD";
                      if (next !== activityClass()) {
                        resetSelection();
                      }
                      setActivityClass(next);
                    }}
                    size="sm"
                    sameWidth
                    skipPortal
                  />
                </HStack>
              </HStack>
            </Show>
          </HStack>
          <Dialog.CloseTrigger aria-label="Close command palette" class={closeClass}>
            <XIcon size={16} />
          </Dialog.CloseTrigger>
        </Box>

        <PalettePathChips
          paths={matchingPaths()}
          query={qTrim()}
          onPick={handlePathLinkClick}
        />

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
                <Text fontSize="sm" color="fg.muted">
                  Loading…
                </Text>
              </Box>
            </Box>
          }
        >
          <Box
            ref={resultsViewportEl}
            role="listbox"
            aria-label="Results"
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            p="1"
            h={resultsPanelHeight}
            overflowY="auto"
            w="full"
            minW="0"
          >
            <Stack gap="0">
              <For each={items()}>
                {(it, idx) => (
                  <>
                    <Show when={idx() === 0 || items()[idx() - 1]?.group !== it.group}>
                      <PaletteGroupLabel>{it.group}</PaletteGroupLabel>
                    </Show>
                    <Switch>
                      <Match when={it.kind === "action" ? it : undefined}>
                        {(action) => (
                          <PaletteActionRow
                            index={idx()}
                            selected={idx() === selectedIndex()}
                            label={action().label}
                            icon={action().icon}
                            trailing={action().shortcut}
                            onHover={() => setSelectedIndex(idx())}
                            onRun={action().run}
                          />
                        )}
                      </Match>
                      <Match when={it.kind === "nav" ? it : undefined}>
                        {(nav) => (
                          <PaletteNavRow
                            index={idx()}
                            selected={idx() === selectedIndex()}
                            label={renderHighlighted(nav().label, qTrim())}
                            icon={nav().icon}
                            href={nav().href}
                            onHover={() => setSelectedIndex(idx())}
                            onActivate={(ev) => handleNavLinkClick(ev, nav().href)}
                          />
                        )}
                      </Match>
                      <Match when={it.kind === "doc" ? it : undefined}>
                        {(doc) => (
                          <a
                            data-command-index={idx()}
                            href={doc().href}
                            role="option"
                            aria-selected={idx() === selectedIndex()}
                            class={docRowClass(idx() === selectedIndex())}
                            onMouseMove={() => setSelectedIndex(idx())}
                            onClick={(e) => handleDocLinkClick(e, doc().key)}
                          >
                            <Text fontSize="sm" fontWeight="medium" truncate>
                              {renderHighlighted(doc().title, qTrim())}
                            </Text>
                            <Show when={doc().path}>
                              {(path) => (
                                <Box class={secondaryRowClass}>
                                  {renderHighlighted(path(), qTrim())}
                                </Box>
                              )}
                            </Show>
                            <Show when={formatSnippet(doc().snippet)}>
                              {(snippet) => (
                                <Box class={snippetClass}>
                                  {renderHighlighted(snippet(), qTrim())}
                                </Box>
                              )}
                            </Show>
                          </a>
                        )}
                      </Match>
                    </Switch>
                  </>
                )}
              </For>

              <Show when={currentResults()?.failed && !results.loading}>
                <Box
                  role="alert"
                  borderWidth="1px"
                  borderColor="gray.outline.border"
                  borderRadius="l2"
                  px="0.75rem"
                  py="0.65rem"
                >
                  <HStack
                    justify="space-between"
                    alignItems="center"
                    gap="0.75rem"
                  >
                    <Text fontSize="sm" color="fg.muted">
                      Could not load results. Try again.
                    </Text>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void retryCommandResults(searchParams(), retrySearch)
                      }
                    >
                      Retry
                    </Button>
                  </HStack>
                </Box>
              </Show>

              <Show
                when={
                  isSearchingEnabled() &&
                  debouncedQuery().length > 0 &&
                  !results.loading &&
                  currentResults()?.failed !== true &&
                  hitsLatest().length === 0
                }
              >
                <Box px="0.75rem" py="0.6rem">
                  <Text fontSize="sm" color="fg.muted">
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
