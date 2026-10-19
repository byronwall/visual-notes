import { Extension } from "@tiptap/core";
import { PluginKey } from "prosemirror-state";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { formatShortcut } from "../toolbar/shortcuts";
import { SLASH_ITEMS, filterSlashItems, type SlashItem } from "./slashItems";

const setStyle = (el: HTMLElement, styles: Partial<CSSStyleDeclaration>) =>
  Object.assign(el.style, styles);

function renderList(
  container: HTMLElement,
  items: SlashItem[],
  selected: number,
) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.textContent = "No matching blocks";
    setStyle(empty, {
      padding: "8px 10px",
      fontSize: "13px",
      color: "var(--colors-fg-muted)",
    });
    container.appendChild(empty);
    return;
  }
  items.forEach((item, idx) => {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.idx = String(idx);
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(idx === selected));
    setStyle(row, {
      display: "grid",
      gridTemplateColumns: "28px 1fr auto",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      textAlign: "left",
      padding: "4px 8px 4px 4px",
      border: "0",
      borderRadius: "6px",
      cursor: "pointer",
      color: "var(--colors-fg-default)",
      background: idx === selected ? "var(--colors-gray-a3)" : "transparent",
    });
    const glyph = document.createElement("span");
    glyph.textContent = item.glyph;
    setStyle(glyph, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "28px",
      height: "28px",
      borderRadius: "6px",
      background: "var(--colors-gray-a2)",
      fontSize: "13px",
      fontWeight: "600",
      color: "var(--colors-fg-muted)",
    });
    const label = document.createElement("span");
    label.textContent = item.title;
    setStyle(label, { fontSize: "14px" });
    const hint = document.createElement("span");
    hint.textContent = item.shortcut ? formatShortcut(item.shortcut) : "";
    setStyle(hint, {
      fontSize: "12px",
      fontFamily: "var(--fonts-mono, ui-monospace, monospace)",
      color: "var(--colors-fg-subtle)",
    });
    row.append(glyph, label, hint);
    container.appendChild(row);
  });
  container
    .querySelector<HTMLElement>(`[data-idx="${selected}"]`)
    ?.scrollIntoView({ block: "nearest" });
}

type Props = SuggestionProps<SlashItem, SlashItem>;

const indexFromEvent = (e: Event) =>
  Number(
    (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-idx]")
      ?.dataset.idx,
  );

function slashRenderer() {
  let popup: TippyInstance | null = null;
  let dom: HTMLDivElement | null = null;
  let selected = 0;
  let last: Props | null = null;

  const draw = () => {
    if (dom && last) renderList(dom, last.items, selected);
  };

  const build = (props: Props) => {
    dom = document.createElement("div");
    dom.setAttribute("role", "listbox");
    dom.setAttribute("aria-label", "Insert block");
    setStyle(dom, {
      display: "grid",
      gap: "1px",
      padding: "4px",
      minWidth: "248px",
      maxHeight: "320px",
      overflowY: "auto",
      background: "var(--colors-bg-default)",
      border: "1px solid var(--colors-border)",
      borderRadius: "10px",
      boxShadow: "var(--shadows-lg)",
    });
    dom.addEventListener("pointermove", (e) => {
      const idx = indexFromEvent(e);
      if (!Number.isFinite(idx) || idx === selected) return;
      selected = idx;
      draw();
    });
    dom.addEventListener(
      "pointerdown",
      (e) => {
        const picked = last?.items[indexFromEvent(e)];
        if (!picked || !last) return;
        // Keep editor focus so the suggestion is not torn down first.
        e.preventDefault();
        last.command(picked);
      },
      { capture: true },
    );
    const rect = props.clientRect?.();
    popup = tippy(document.body, {
      getReferenceClientRect: () =>
        props.clientRect?.() ?? rect ?? new DOMRect(),
      appendTo: () => document.body,
      content: dom,
      showOnCreate: true,
      interactive: true,
      trigger: "manual",
      placement: "bottom-start",
      offset: [0, 6],
      arrow: false,
      maxWidth: "none",
    });
  };

  return {
    onStart: (props: Props) => {
      last = props;
      selected = 0;
      build(props);
      draw();
    },
    onUpdate: (props: Props) => {
      last = props;
      if (selected >= props.items.length) selected = 0;
      popup?.setProps({
        getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
      });
      draw();
    },
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (!last) return false;
      const count = last.items.length;
      if (event.key === "Escape") {
        popup?.hide();
        return true;
      }
      if (event.key === "ArrowDown" && count) {
        selected = (selected + 1) % count;
        draw();
        return true;
      }
      if (event.key === "ArrowUp" && count) {
        selected = (selected - 1 + count) % count;
        draw();
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const picked = last.items[selected];
        if (!picked) return false;
        last.command(picked);
        return true;
      }
      return false;
    },
    onExit: () => {
      popup?.destroy();
      popup = null;
      dom = null;
      last = null;
    },
  };
}

/**
 * Type `/` at the start of a line (or after a space) to pick a block type
 * from the keyboard: arrows to move, Enter to insert, Esc to dismiss.
 */
export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommands"),
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          // Never inside code, and only at a word boundary so URLs and
          // fractions like 1/2 don't open the menu.
          if ($from.parent.type.spec.code) return false;
          const before = state.doc.textBetween(
            Math.max($from.start(), range.from - 1),
            range.from,
          );
          return before === "" || /\s/.test(before);
        },
        items: ({ query }) => filterSlashItems(SLASH_ITEMS, query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: slashRenderer,
      }),
    ];
  },
});
