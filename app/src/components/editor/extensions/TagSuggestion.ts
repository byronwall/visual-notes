import { Extension, InputRule } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
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

// Same shape the markdown reader accepts, so a typed tag survives a round trip.
// `#42` stays text: it is usually an issue number.
const TAG_NAME = "[A-Za-z][A-Za-z0-9_\\-/]{0,63}";
const TAG_AT_END = new RegExp(`(?:^|[\\s(])#(${TAG_NAME})$`);
const TAG_CHAR = /^[A-Za-z0-9_\-/]/;

/** The `#word` that ends at `pos`, ready to replace with a tag node. */
const typedTagAt = (state: EditorState, pos: number) => {
  const $pos = state.doc.resolve(pos);
  if ($pos.parent.type.spec.code) return null;
  const before = $pos.parent.textBetween(
    0,
    $pos.parentOffset,
    undefined,
    (leaf) => (leaf.type.name === "hardBreak" ? "\n" : "\ufffc"),
  );
  const name = before.match(TAG_AT_END)?.[1];
  if (!name) return null;
  const from = pos - name.length - 1;
  const { code, link } = state.schema.marks;
  if (state.doc.rangeHasMark(from, pos, code)) return null;
  if (state.doc.rangeHasMark(from, pos, link)) return null;
  const tag = state.schema.nodes.tag.create({ name: name.toLowerCase() });
  return { from, tag };
};

/**
 * A tag forms when the typed `#word` ends, so the menu is optional. Plain
 * `#word` text already in a note stays text until someone types right after
 * it: stored notes are never rewritten, and a click through them changes
 * nothing. Backspace right after the tag turns it back into text.
 */
const finishTagOnLeave = () => {
  let typing = false;
  let typedAt: number | null = null;

  const finish = (state: EditorState) => {
    if (typedAt === null) return null;
    const pos = typedAt;
    typedAt = null;
    if (TAG_CHAR.test(state.doc.textBetween(pos, pos + 1, "", ""))) return null;
    const typed = typedTagAt(state, pos);
    return typed ? state.tr.replaceWith(typed.from, pos, typed.tag) : null;
  };

  return new Plugin({
    key: new PluginKey("tagOnLeave"),
    props: {
      handleTextInput: () => {
        typing = true;
        return false;
      },
      handleDOMEvents: {
        blur: (view) => {
          // The window lost focus; the caret is still in the word.
          if (document.activeElement === view.dom) return false;
          const tr = finish(view.state);
          if (tr) view.dispatch(tr);
          return false;
        },
      },
    },
    appendTransaction: (transactions, _old, state) => {
      const { selection } = state;
      if (typing && transactions.some((tr) => tr.docChanged)) {
        typing = false;
        typedAt = selection.from;
        return null;
      }
      if (typedAt === null) return null;
      // -1 keeps the word's end in place when Enter splits the block there.
      for (const tr of transactions) typedAt = tr.mapping.map(typedAt, -1);
      const typed = typedTagAt(state, typedAt);
      const inWord =
        selection.empty &&
        !!typed &&
        selection.from > typed.from &&
        selection.from <= typedAt;
      return inWord ? null : finish(state);
    },
  });
};

/**
 * `#` after a space opens a tag picker (existing tags first, or create a new
 * one). Not at the start of a line, where `# ` makes a heading.
 */
export const TagSuggestion = Extension.create({
  name: "tagSuggestion",

  addInputRules() {
    return [
      new InputRule({
        // Enter reaches input rules as "\n". Leave it to the normal split, so
        // the rule covers a space or closing punctuation only.
        find: new RegExp(`#${TAG_NAME}(?:[^\\S\\n]|[.,;:!?)])$`),
        handler: ({ state, range, match }) => {
          const end = range.from + match[0].length - 1;
          const typed = typedTagAt(state, end);
          if (!typed) return null;
          state.tr.replaceWith(typed.from, range.to, [
            typed.tag,
            state.schema.text(match[0].slice(-1)),
          ]);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      finishTagOnLeave(),
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
          // A digit-first tag would read back as text from markdown.
          const creatable = TAG_PATTERN.test(name) && /^[a-z]/.test(name);
          if (creatable && !existing.includes(name)) {
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
