import { Extension } from "@tiptap/core";
import { PluginKey } from "prosemirror-state";
import Suggestion from "@tiptap/suggestion";
import { formatShortcut } from "../toolbar/shortcuts";
import { SLASH_ITEMS, filterSlashItems, type SlashItem } from "./slashItems";
import { createSuggestionMenu, setStyle } from "./suggestionMenu";

const slashRenderer = createSuggestionMenu<SlashItem>({
  ariaLabel: "Insert block",
  emptyText: "No matching blocks",
  renderRow: (item, row) => {
    setStyle(row, {
      display: "grid",
      gridTemplateColumns: "28px 1fr auto",
      alignItems: "center",
      gap: "10px",
      padding: "4px 8px 4px 4px",
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
  },
});

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
