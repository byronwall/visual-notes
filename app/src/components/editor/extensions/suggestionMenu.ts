import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";

export const setStyle = (
  el: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
) => Object.assign(el.style, styles);

type MenuOptions<T> = {
  ariaLabel: string;
  emptyText: string;
  minWidth?: string;
  /** Builds the visual content of one row; the menu owns the button shell. */
  renderRow: (item: T, row: HTMLButtonElement) => void;
};

const indexFromEvent = (e: Event) =>
  Number(
    (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-idx]")
      ?.dataset.idx,
  );

/**
 * Keyboard-first popup for TipTap suggestions: arrows move, Enter/Tab pick,
 * Esc dismisses, and the pointer can hover and click rows.
 */
export function createSuggestionMenu<T>(opts: MenuOptions<T>) {
  return () => {
    type Props = SuggestionProps<T, T>;
    let popup: TippyInstance | null = null;
    let dom: HTMLDivElement | null = null;
    let selected = 0;
    let last: Props | null = null;

    const draw = () => {
      if (!dom || !last) return;
      const items = last.items;
      dom.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("div");
        empty.textContent = opts.emptyText;
        setStyle(empty, {
          padding: "8px 10px",
          fontSize: "13px",
          color: "var(--colors-fg-muted)",
        });
        dom.appendChild(empty);
        return;
      }
      items.forEach((item, idx) => {
        const row = document.createElement("button");
        row.type = "button";
        row.dataset.idx = String(idx);
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(idx === selected));
        setStyle(row, {
          width: "100%",
          textAlign: "left",
          border: "0",
          borderRadius: "6px",
          cursor: "pointer",
          color: "var(--colors-fg-default)",
          background:
            idx === selected ? "var(--colors-gray-a3)" : "transparent",
        });
        opts.renderRow(item, row);
        dom!.appendChild(row);
      });
      dom
        .querySelector<HTMLElement>(`[data-idx="${selected}"]`)
        ?.scrollIntoView({ block: "nearest" });
    };

    const build = (props: Props) => {
      dom = document.createElement("div");
      dom.setAttribute("role", "listbox");
      dom.setAttribute("aria-label", opts.ariaLabel);
      setStyle(dom, {
        display: "grid",
        gap: "1px",
        padding: "4px",
        minWidth: opts.minWidth ?? "248px",
        maxWidth: "420px",
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
  };
}
