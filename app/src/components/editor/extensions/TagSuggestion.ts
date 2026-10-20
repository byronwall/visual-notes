import { Extension } from "@tiptap/core";
import { PluginKey } from "prosemirror-state";
import Suggestion from "@tiptap/suggestion";
import { normalizeTagName, TAG_PATTERN } from "~/lib/note-content/tag";
import { fetchTagNames } from "~/services/note-views.queries";
import { createSuggestionMenu, setStyle } from "./suggestionMenu";

type TagItem = { name: string; isNew: boolean };

const tagRenderer = createSuggestionMenu<TagItem>({
  ariaLabel: "Tag",
  emptyText: "Type a tag name",
  minWidth: "200px",
  renderRow: (item, row) => {
    setStyle(row, { padding: "6px 8px", fontSize: "14px" });
    row.textContent = item.isNew ? `Create #${item.name}` : `#${item.name}`;
  },
});

/**
 * `#` after a space opens a tag picker (existing tags first, or create a new
 * one). Not at the start of a line, where `# ` makes a heading.
 */
export const TagSuggestion = Extension.create({
  name: "tagSuggestion",

  addProseMirrorPlugins() {
    return [
      Suggestion<TagItem, TagItem>({
        editor: this.editor,
        pluginKey: new PluginKey("tagSuggestion"),
        char: "#",
        allowSpaces: false,
        startOfLine: false,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.spec.code) return false;
          if ($from.parentOffset === 0) return false;
          const before = state.doc.textBetween(range.from - 1, range.from);
          return /\s/.test(before);
        },
        items: async ({ query }) => {
          const name = normalizeTagName(query);
          if (!name) return [];
          let existing: string[] = [];
          try {
            existing = await fetchTagNames(name);
          } catch (e) {
            console.warn("[tags] lookup failed", e);
          }
          const items = existing.map((n) => ({ name: n, isNew: false }));
          if (TAG_PATTERN.test(name) && !existing.includes(name)) {
            items.push({ name, isNew: true });
          }
          return items;
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: "tag", attrs: { name: props.name } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: tagRenderer,
      }),
    ];
  },
});
