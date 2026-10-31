import {
  escapeForRegEx,
  InputRule,
  mergeAttributes,
  Node,
  nodeInputRule,
  PasteRule,
} from "@tiptap/core";
import type { EmojiItem } from "@tiptap/extension-emoji";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { createEmojiSuggestion } from "./emojiSuggestion";

/**
 * The editor's emoji node. @tiptap/extension-emoji ships its Emoji extension
 * and about 440 KB of emoji data in one module, so importing it here would put
 * that data on every note route. This node has the same schema and loads the
 * data with a dynamic import when the editor gets focus, when `:` opens the
 * suggestion, or when a note holds an emoji. The server still uses the package
 * extension directly (see `note-content/convert.ts`).
 */

type EmojiData = { items: readonly EmojiItem[]; emoticons: RegExp | null };

let data: EmojiData | undefined;
let loading: Promise<readonly EmojiItem[]> | undefined;

export function loadEmojis(): Promise<readonly EmojiItem[]> {
  loading ??= import("@tiptap/extension-emoji").then(
    ({ gitHubEmojis }) => {
      const emoticons = gitHubEmojis.flatMap((item) => item.emoticons ?? []);
      data = {
        items: gitHubEmojis,
        emoticons: new RegExp(
          `(?:^|\\s)(${emoticons.map((item) => escapeForRegEx(item)).join("|")}) $`,
        ),
      };
      return gitHubEmojis;
    },
    (error) => {
      // A later focus or `:` tries again; until then emoji show as `:name:`.
      console.warn("[emoji] failed to load emoji data", error);
      loading = undefined;
      return [];
    },
  );
  return loading;
}

function findEmoji(name: string) {
  return data?.items.find(
    (item) => name === item.name || item.shortcodes.includes(name),
  );
}

function fillEmoji(dom: HTMLElement, name: string) {
  const item = findEmoji(name);
  if (item?.emoji) {
    dom.textContent = item.emoji;
  } else if (item?.fallbackImage) {
    const img = document.createElement("img");
    img.src = item.fallbackImage;
    img.draggable = false;
    img.loading = "lazy";
    img.alt = `${item.name} emoji`;
    dom.replaceChildren(img);
  } else {
    dom.textContent = `:${name}:`;
  }
}

const inputRegex = /:([a-zA-Z0-9_+-]+):$/;
const pasteRegex = /(^|\s):([a-zA-Z0-9_+-]+):/g;

export const NoteEmoji = Node.create({
  name: "emoji",
  inline: true,
  group: "inline",
  selectable: false,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.dataset.name,
        renderHTML: (attributes) => ({ "data-name": attributes.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  // The editor shows the node view. This output is for copy and getHTML, where
  // `data-name` carries the emoji even if the data has not loaded.
  renderHTML({ HTMLAttributes, node }) {
    const item = findEmoji(node.attrs.name);
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": this.name }),
      item?.emoji || `:${node.attrs.name}:`,
    ];
  },

  renderText({ node }) {
    return findEmoji(node.attrs.name)?.emoji || `:${node.attrs.name}:`;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.dataset.type = this.name;
      dom.dataset.name = node.attrs.name;
      fillEmoji(dom, node.attrs.name);
      if (!data) {
        void loadEmojis().then(() => fillEmoji(dom, node.attrs.name));
      }
      return { dom, ignoreMutation: () => true };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: inputRegex,
        handler: ({ range, match, chain }) => {
          const name = match[1];
          if (!name || !findEmoji(name)) return;
          chain()
            .insertContentAt(range, { type: this.name, attrs: { name } })
            .command(({ tr, state }) => {
              tr.setStoredMarks(
                state.doc.resolve(state.selection.to - 1).marks(),
              );
              return true;
            })
            .run();
        },
      }),
      nodeInputRule({
        find: (text) => {
          const match = data?.emoticons?.exec(text);
          if (!match) return null;
          return { index: match.index, text: match[0], replaceWith: match[1] };
        },
        type: this.type,
        getAttributes: (match) => ({
          name: data?.items.find((item) => item.emoticons?.includes(match[1]!))
            ?.name,
        }),
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: pasteRegex,
        handler: ({ range, match, chain }) => {
          const prefix = match[1] || "";
          const name = match[2];
          if (!name || !findEmoji(name)) return;
          chain()
            .insertContentAt(
              { from: range.from + prefix.length, to: range.to },
              { type: this.name, attrs: { name } },
              { updateSelection: false },
            )
            .command(({ tr, state }) => {
              tr.setStoredMarks(
                state.doc.resolve(state.selection.to - 1).marks(),
              );
              return true;
            })
            .run();
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const { editor, name } = this;
    const type = this.type;
    return [
      Suggestion({
        editor,
        char: ":",
        pluginKey: new PluginKey("emojiSuggestion"),
        command: ({ editor, range, props }) => {
          const after = editor.view.state.selection.$to.nodeAfter;
          if (after?.text?.startsWith(" ")) range.to += 1;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: name, attrs: props },
              { type: "text", text: " " },
            ])
            .command(({ tr, state }) => {
              tr.setStoredMarks(
                state.doc.resolve(state.selection.to - 2).marks(),
              );
              return true;
            })
            .run();
        },
        allow: ({ state, range }) =>
          !!state.doc
            .resolve(range.from)
            .parent.type.contentMatch.matchType(type),
        ...createEmojiSuggestion(loadEmojis),
      }),
      new Plugin({
        key: new PluginKey("emoji"),
        props: {
          handleDOMEvents: {
            // Load before the first keystroke or paste: input and paste rules
            // run synchronously and need the data to recognize a shortcode.
            focus: () => {
              void loadEmojis();
              return false;
            },
          },
          // Double click does not select an emoji by default.
          handleDoubleClickOn: (_view, pos, node) => {
            if (node.type !== type) return false;
            editor.commands.setTextSelection({
              from: pos,
              to: pos + node.nodeSize,
            });
            return true;
          },
        },
      }),
    ];
  },
});
