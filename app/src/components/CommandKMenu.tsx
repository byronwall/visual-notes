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
  type VoidComponent,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Spinner } from "~/components/ui/spinner";
import { Text } from "~/components/ui/text";
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
import { PaletteSortMenu } from "~/components/command-palette/PaletteSortMenu";
import * as Dialog from "~/components/ui/dialog";
import {
  CompassIcon,
  DatabaseIcon,
  ListTodoIcon,
  TelescopeIcon,
  XIcon,
} from "lucide-solid";
import { fetchCollections } from "~/services/collections/collections.queries";
import {
  bestRowIndex,
  matchActions,
  matchDestinations,
  type PaletteAction,
  type PaletteIcon,
} from "~/components/command-palette/palette-commands";
import { ALL_DESTINATIONS } from "~/components/sidebar/nav-items";
import { isDoneStatus } from "~/components/tasks/taskFormat";

type CommandKMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNewNote: (initialTitle: string | undefined) => void;
  /** Shell-level commands (chat, sidebar, logs) matched by name while typing. */
  actions?: PaletteAction[];
};

type CommandGroup =
  | "Actions"
  | "Go to"
  | "Notes"
  | "Recent"
  | "Tasks"
  | "Research"
  | "Saved pages";

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
      trailing?: string;
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
  // A row the user chose with the arrows or pointer. Null means the best row.
  const [pickedIndex, setPickedIndex] = createSignal<number | null>(null);
  // Enter was pressed before this query's results arrived.
  const [enterPending, setEnterPending] = createSignal(false);
  const [debouncedQuery, setDebouncedQuery] = createSignal("");
  const [sortMode, setSortMode] =
    createSignal<CommandSearchParams["sortMode"]>("relevance");
  const [activityClass, setActivityClass] =
    createSignal<CommandSearchParams["activityClass"]>("");
  let inputEl: HTMLInputElement | undefined;
  let resultsViewportEl: HTMLDivElement | undefined;

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
  // These two only add rows, and reading a rejected resource throws to the
  // app's error boundary, so a failure leaves them empty. Search shows the error.
  // Collections are destinations too: "reading" jumps to the Reading collection.
  const [collections] = createResource(
    () => props.open,
    async (isOpen) => (isOpen ? fetchCollections().catch(() => []) : []),
  );
  const [allPathSuggestions] = createResource(() => props.open, async (isOpen) => {
    if (!isOpen) return [];
    return fetchPathSuggestions().catch(() => []);
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

  const linkRow = (
    group: CommandGroup,
    icon: PaletteIcon,
    href: string,
    label: string,
    trailing?: string | null,
  ): CommandItem => ({
    kind: "nav",
    group,
    key: `${group}:${href}`,
    href,
    label,
    icon,
    trailing: trailing ?? undefined,
    run: () => {
      close();
      navigate(href);
    },
  });

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
    ]).map((dest) => linkRow("Go to", dest.icon, dest.href, dest.label));

    // Use `latest` to avoid Suspense re-triggering (UI flashing) on each query change.
    const found = currentResults();
    const hits = found?.items ?? [];
    const tasks = (found?.tasks ?? []).map((task) =>
      linkRow(
        "Tasks",
        ListTodoIcon,
        `/tasks?list=${task.listId}${isDoneStatus(task.status) ? "&done=1" : ""}`,
        task.description,
        task.listName,
      ),
    );
    const topics = (found?.topics ?? []).map((topic) =>
      linkRow("Research", TelescopeIcon, `/research/${topic.slug}`, topic.title, ""),
    );
    const pages = (found?.pages ?? []).map((page) =>
      linkRow(
        "Saved pages",
        CompassIcon,
        `/archive?item=${encodeURIComponent(page.id)}`,
        page.title,
        page.hostname ?? "",
      ),
    );
    const others = [...tasks, ...topics, ...pages];
    const docGroup: CommandGroup = q ? "Notes" : "Recent";
    // Fewer notes when other kinds match, so their groups stay on screen. Only
    // under relevance: another sort can put an exact title further down.
    const docLimit = others.length > 0 && sortMode() === "relevance" ? 6 : 10;
    const mapped: CommandItem[] = hits.slice(0, docLimit).map((d) => ({
      kind: "doc",
      group: docGroup,
      key: d.id,
      href: `/docs/${d.id}`,
      title: d.title,
      path: d.path,
      snippet: d.snippet,
      run: () => handleOpenDoc(d.id),
    }));

    return [...base, ...actionHits, ...navHits, ...mapped, ...others];
  });

  const bestIndex = createMemo(() =>
    bestRowIndex(
      qTrim(),
      items().map((it) => (it.kind === "doc" ? it.title : it.label)),
    ),
  );

  const clampSelected = (next: number) => {
    const max = Math.max(0, items().length - 1);
    return Math.max(0, Math.min(max, next));
  };

  const selectedIndex = () => clampSelected(pickedIndex() ?? bestIndex());

  const pickRow = (index: number) => {
    setEnterPending(false);
    setPickedIndex(index);
  };

  const resetSelection = () => {
    setEnterPending(false);
    setPickedIndex(null);
    if (resultsViewportEl) resultsViewportEl.scrollTop = 0;
  };

  const scrollSelectedIntoView = () => {
    resultsViewportEl
      ?.querySelector<HTMLElement>(`[data-command-index="${selectedIndex()}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  };

  const moveSelected = (delta: number) => {
    const next = clampSelected(selectedIndex() + delta);
    // No row to move to is not a choice, so the best row stays in charge.
    if (next === selectedIndex()) return;
    pickRow(next);
    scrollSelectedIntoView();
  };

  const runSelected = () => {
    const it = items()[selectedIndex()];
    if (!it) return;
    it.run();
  };

  const resultsPending = () => qForSearch().length > 0 && !currentResults();

  const handleEnter = () => {
    // A row the user chose runs at once. Otherwise the best row isn't known
    // yet, so skip the debounce and run it when the results arrive.
    if (pickedIndex() === null && resultsPending()) {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      setDebouncedQuery(qForSearch());
      setEnterPending(true);
      return;
    }
    runSelected();
  };

  createEffect(() => {
    if (!enterPending() || resultsPending()) return;
    setEnterPending(false);
    // No match or a failed search leaves New note selected. That Enter was
    // aimed at a result, so creating a note takes a second Enter.
    if (selectedIndex() !== 0) runSelected();
  });

  createEffect(() => {
    void bestIndex();
    if (pickedIndex() === null) scrollSelectedIntoView();
  });

  const handleInputKeyDown = (ev: KeyboardEvent) => {
    if (
      ev.metaKey &&
      !ev.altKey &&
      !ev.ctrlKey &&
      !ev.shiftKey &&
      ev.key.toLowerCase() === "d"
    ) {
      ev.preventDefault();
      handleCreateNewNote();
      return;
    }
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
      handleEnter();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
      return;
    }
  };

  createEffect(() => {
    resetSelection();
    if (!props.open) {
      setSortMode("relevance");
      setActivityClass("");
      return;
    }
    window.setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 0);
  });

  createEffect(() => {
    // Each new query goes back to its best row.
    void query();
    resetSelection();
  });

  const isSearchingEnabled = () => qForSearch().length > 0;
  const isSearching = () => results.loading;

  const rowBg = (active: boolean) => (active ? "gray.a3" : "transparent");

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
  // The close button takes its own column so it can't sit over the sort menu.
  const headerClass = css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gridTemplateAreas: '"input controls close"',
    alignItems: "center",
    columnGap: "2",
    rowGap: "2",
    w: "full",
    minW: "0",
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
  const hasResults = () => {
    const found = currentResults();
    return Boolean(
      found &&
        found.items.length +
          found.tasks.length +
          found.topics.length +
          found.pages.length >
          0,
    );
  };
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
            placeholder="Search notes, tasks, research, and saved pages…"
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
            {/* Fixed width, so the spinner never moves the input. */}
            <Box w="4" display="flex" justifyContent="center">
              <Show when={isSearching()}>
                <Spinner size="xs" color="fg.muted" />
              </Show>
            </Box>
            <PaletteSortMenu
              sortMode={sortMode()}
              activityClass={activityClass()}
              onSortMode={(next) => {
                if (next !== sortMode()) resetSelection();
                setSortMode(next);
              }}
              onActivityClass={(next) => {
                if (next !== activityClass()) resetSelection();
                setActivityClass(next);
              }}
            />
          </HStack>
          <Dialog.CloseTrigger aria-label="Close command palette" class={closeClass}>
            <XIcon size={16} />
          </Dialog.CloseTrigger>
        </Box>

        <Show when={matchingPaths().length > 0}>
          <PalettePathChips
            paths={matchingPaths()}
            query={qTrim()}
            onPick={handlePathLinkClick}
          />
        </Show>

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
                            onHover={() => pickRow(idx())}
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
                            trailing={nav().trailing}
                            onHover={() => pickRow(idx())}
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
                            onMouseMove={() => pickRow(idx())}
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
                  !hasResults()
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
