import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
} from "solid-js";

const LOG_PREFIX = "[docs-index/keys]";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const hasOpenOverlay = () =>
  !!document.querySelector(
    "[role=dialog][data-state=open], [role=menu][data-state=open], [role=listbox][data-state=open]",
  );

/**
 * List keyboard model for the notes index:
 * `/` focuses search, j/k or arrows move, Enter opens (⌘/Ctrl+Enter in a new
 * tab), x toggles selection, Esc clears selection then search.
 */
export const useDocsListKeyboard = (args: {
  ids: Accessor<string[]>;
  searchInput: Accessor<HTMLInputElement | undefined>;
  hasSelection: Accessor<boolean>;
  hasSearch: Accessor<boolean>;
  onOpen: (id: string, newTab: boolean) => void;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onClearSearch: () => void;
}) => {
  const [activeId, setActiveId] = createSignal<string | null>(null);

  // Drop the highlight when its row leaves the list (filters, search).
  createEffect(() => {
    const id = activeId();
    if (id && !args.ids().includes(id)) setActiveId(null);
  });

  const scrollToActive = (id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-doc-id="${CSS.escape(id)}"]`,
    );
    // Rows set scroll-margin so the sticky header never covers them.
    el?.scrollIntoView({ block: "nearest" });
  };

  const move = (delta: number) => {
    const ids = args.ids();
    if (!ids.length) return;
    const current = activeId();
    const index = current ? ids.indexOf(current) : -1;
    const next =
      index < 0
        ? delta > 0
          ? 0
          : ids.length - 1
        : Math.max(0, Math.min(ids.length - 1, index + delta));
    const id = ids[next];
    setActiveId(id);
    scrollToActive(id);
  };

  const openActive = (newTab: boolean) => {
    const id = activeId() ?? args.ids()[0];
    if (!id) return false;
    args.onOpen(id, newTab);
    return true;
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
      move(1);
    } else if (e.key === "Enter") {
      if (openActive(e.metaKey || e.ctrlKey)) e.preventDefault();
    } else if (e.key === "Escape") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.value) args.onClearSearch();
      else input.blur();
    }
  };

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      if (isTypingTarget(e.target) || hasOpenOverlay()) return;
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "/" && !mod) {
        e.preventDefault();
        args.searchInput()?.focus();
        args.searchInput()?.select();
        return;
      }
      if (mod && e.key !== "Enter") return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          move(1);
          return;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          return;
        case "Enter":
        case "o": {
          // Let focused links/buttons handle their own Enter.
          if (e.target instanceof HTMLElement && e.target.closest("a, button"))
            return;
          if (activeId() && openActive(mod)) e.preventDefault();
          return;
        }
        case "x": {
          const id = activeId();
          if (!id) return;
          e.preventDefault();
          args.onToggleSelect(id);
          return;
        }
        case "Escape":
          if (args.hasSelection()) {
            args.onClearSelection();
          } else if (activeId()) {
            setActiveId(null);
          } else if (args.hasSearch()) {
            args.onClearSearch();
          }
          return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    console.debug(`${LOG_PREFIX} listening`);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return { activeId, setActiveId, handleSearchKeyDown };
};
