import type { Editor } from "@tiptap/core";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import { type Instance as TippyInstance } from "tippy.js";
import tippy from "tippy.js";
import { gitHubEmojis } from "@tiptap/extension-emoji";

type EmojiItem = (typeof gitHubEmojis)[number];

type EmojiSuggestionConfig = Omit<
  SuggestionOptions<EmojiItem, EmojiItem>,
  "editor"
>;
type EmojiSuggestionProps = SuggestionProps<EmojiItem, EmojiItem>;

function filterEmojis(emojis: readonly EmojiItem[], query: string) {
  const q = query.trim().toLowerCase();

  const allowRegional = q.startsWith("regional") || q.startsWith("indicator");

  const startsWith = (s: string) => s.toLowerCase().startsWith(q);
  const includes = (s: string) => s.toLowerCase().includes(q);

  const matchScore = (e: EmojiItem) => {
    const names = [
      e.name ?? "",
      ...(e.shortcodes ?? []),
      ...(e.tags ?? []),
      ...(e.emoticons ?? []),
    ].filter(Boolean);
    if (names.some(startsWith)) return 0;
    if (names.some(includes)) return 1;
    return 2;
  };

  const matches = emojis
    .filter((e) => matchScore(e) < 2)
    .filter((e) => {
      if (allowRegional) return true;
      return !(e.name ?? "").toLowerCase().startsWith("regional_indicator_");
    })
    .sort((a, b) => matchScore(a) - matchScore(b));

  return matches.slice(0, 20);
}

function renderSuggestionList(
  container: HTMLElement,
  items: EmojiItem[],
  selected: number
) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.textContent = "No results";
    empty.style.padding = "8px 10px";
    empty.style.color = "var(--colors-fg-muted, #6b7280)";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.style.display = "grid";

  items.forEach((item, idx) => {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.idx = String(idx);
    row.style.display = "grid";
    row.style.gridTemplateColumns = "20px 1fr";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.width = "100%";
    row.style.textAlign = "left";
    row.style.padding = "6px 10px";
    row.style.border = "0";
    row.style.background =
      idx === selected ? "rgba(59, 130, 246, 0.12)" : "transparent";
    row.style.cursor = "pointer";

    const emoji = document.createElement("span");
    emoji.textContent = item.emoji ?? "";
    emoji.style.fontSize = "16px";
    emoji.style.lineHeight = "1";

    const label = document.createElement("span");
    const shortcode = item.shortcodes?.[0];
    label.textContent = shortcode ? `:${shortcode}:` : item.name ?? "";
    label.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    label.style.fontSize = "12px";
    label.style.color = "var(--colors-fg-default, #111827)";

    row.appendChild(emoji);
    row.appendChild(label);
    list.appendChild(row);
  });

  container.appendChild(list);
}

export function createEmojiSuggestion(emojis: readonly EmojiItem[]) {
  // The Emoji extension expects a Suggestion config. We avoid importing types
  // from @tiptap/suggestion here to keep this module small and decoupled.
  const suggestion: EmojiSuggestionConfig = {
    items: ({ query }: { query: string; editor: Editor }) =>
      filterEmojis(emojis, query),
    render: () => {
      let popup: TippyInstance | null = null;
      let dom: HTMLDivElement | null = null;
      let selectedIndex = 0;
      let lastProps: EmojiSuggestionProps | null = null;
      let interactionsAttached = false;

      const update = (props: EmojiSuggestionProps) => {
        lastProps = props;
        if (!dom) return;
        if (selectedIndex >= props.items.length) selectedIndex = 0;
        renderSuggestionList(dom, props.items, selectedIndex);
      };

      const onKeyDown = (props: SuggestionKeyDownProps) => {
        if (!lastProps) return false;
        const items = lastProps.items;

        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }

        if (props.event.key === "ArrowDown") {
          selectedIndex = items.length ? (selectedIndex + 1) % items.length : 0;
          update(lastProps);
          return true;
        }

        if (props.event.key === "ArrowUp") {
          selectedIndex = items.length
            ? (selectedIndex - 1 + items.length) % items.length
            : 0;
          update(lastProps);
          return true;
        }

        if (props.event.key === "Enter" || props.event.key === "Tab") {
          const picked = items[selectedIndex];
          if (!picked) return false;
          console.log("[emoji] pick:", picked.shortcodes?.[0] ?? picked.name);
          lastProps.command(picked);
          return true;
        }

        return false;
      };

      const ensurePopup = (props: EmojiSuggestionProps) => {
        if (popup || dom) return;
        const rect = props.clientRect?.();
        if (!rect) return;
        if (!props.items.length) return;

        selectedIndex = 0;
        dom = document.createElement("div");
        dom.style.maxHeight = "240px";
        dom.style.overflow = "auto";
        dom.style.minWidth = "220px";
        dom.style.background = "white";
        dom.style.border = "1px solid rgba(0,0,0,0.08)";
        dom.style.borderRadius = "10px";
        dom.style.boxShadow = "0 10px 30px rgba(0,0,0,0.12)";

        if (!interactionsAttached) {
          interactionsAttached = true;

          const pick = (idx: number) => {
            const picked = lastProps?.items[idx];
            if (!picked || !lastProps) return;
            console.log(
              "[emoji] pick (pointer):",
              picked.shortcodes?.[0] ?? picked.name
            );
            lastProps.command(picked);
          };

          dom.addEventListener("pointermove", (e) => {
            const el = (e.target as HTMLElement | null)?.closest("button");
            const idxStr = el?.dataset?.idx;
            if (!idxStr) return;
            const idx = Number(idxStr);
            if (!Number.isFinite(idx)) return;
            if (idx === selectedIndex) return;
            selectedIndex = idx;
            if (lastProps)
              renderSuggestionList(dom!, lastProps.items, selectedIndex);
          });

          dom.addEventListener(
            "pointerdown",
            (e) => {
              const el = (e.target as HTMLElement | null)?.closest("button");
              const idxStr = el?.dataset?.idx;
              if (!idxStr) return;
              const idx = Number(idxStr);
              if (!Number.isFinite(idx)) return;
              // Prevent editor blur / suggestion teardown before selection.
              e.preventDefault();
              e.stopPropagation();
              pick(idx);
            },
            { capture: true }
          );
        }

        update(props);

        const instances = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() ?? rect,
          appendTo: () => document.body,
          content: dom,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          hideOnClick: false,
        });

        popup = instances[0] ?? null;
      };

      return {
        onStart: (props: EmojiSuggestionProps) => {
          ensurePopup(props);
        },
        onUpdate: (props: EmojiSuggestionProps) => {
          const rect = props.clientRect?.();
          if (!rect) return;

          if (!popup) {
            ensurePopup(props);
            return;
          }

          if (!props.items.length) {
            popup.hide();
            return;
          }

          update(props);
          popup.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? rect,
          });
          popup.show();
        },
        onKeyDown,
        onExit: () => {
          popup?.destroy();
          popup = null;
          dom = null;
          lastProps = null;
        },
      };
    },
  };

  return suggestion;
}
