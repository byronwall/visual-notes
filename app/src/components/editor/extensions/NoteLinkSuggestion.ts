import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import Suggestion from "@tiptap/suggestion";
import {
  fetchLinkLabel,
  fetchLinkTargets,
  type LinkTarget,
} from "~/services/note-links.queries";
import { createSuggestionMenu, setStyle } from "./suggestionMenu";

/** Window event the note page listens for to navigate without a reload. */
export const NOTE_LINK_NAVIGATE_EVENT = "note-link:navigate";

const INTERNAL_URL =
  /^(?:https?:\/\/([^/\s]+))?\/docs\/([A-Za-z0-9_-]+)(?:#b-([A-Za-z0-9]+))?\s*$/;

const linkRenderer = createSuggestionMenu<LinkTarget>({
  ariaLabel: "Link to note",
  emptyText: "No matching notes",
  minWidth: "300px",
  renderRow: (item, row) => {
    setStyle(row, {
      display: "grid",
      gridTemplateColumns: "20px 1fr",
      alignItems: "center",
      gap: "8px",
      padding: "6px 8px",
    });
    const glyph = document.createElement("span");
    glyph.textContent = item.kind === "heading" ? "#" : "↗";
    setStyle(glyph, {
      color: "var(--colors-fg-subtle)",
      fontSize: "13px",
      textAlign: "center",
    });
    const text = document.createElement("span");
    setStyle(text, { display: "grid", minWidth: "0" });
    const label = document.createElement("span");
    label.textContent = item.label || "Untitled note";
    setStyle(label, {
      fontSize: "14px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    text.appendChild(label);
    if (item.context) {
      const context = document.createElement("span");
      context.textContent =
        item.kind === "heading" ? `in ${item.context}` : item.context;
      setStyle(context, {
        fontSize: "12px",
        color: "var(--colors-fg-muted)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      });
      text.appendChild(context);
    }
    row.append(glyph, text);
  },
});

/**
 * `[[` opens a picker of notes and headings and inserts a link node that
 * stores ids. Clicking a note link navigates; pasting a note URL from this
 * app turns it into a link.
 */
export const NoteLinkSuggestion = Extension.create({
  name: "noteLinkSuggestion",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      Suggestion<LinkTarget, LinkTarget>({
        editor,
        pluginKey: new PluginKey("noteLinkSuggestion"),
        char: "[[",
        allowSpaces: true,
        startOfLine: false,
        allow: ({ state, range }) =>
          !state.doc.resolve(range.from).parent.type.spec.code,
        items: async ({ query }) => {
          try {
            return await fetchLinkTargets({ query: query.replace(/]+$/, "") });
          } catch (e) {
            console.warn("[note-links] target search failed", e);
            return [];
          }
        },
        command: ({ editor: ed, range, props }) => {
          ed.chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: "noteLink",
                attrs: {
                  docId: props.docId,
                  blockId: props.blockId,
                  label: props.label,
                },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: linkRenderer,
      }),
      new Plugin({
        key: new PluginKey("noteLinkInteractions"),
        props: {
          handleDOMEvents: {
            click: (_view, event) => {
              const anchor = (event.target as HTMLElement | null)?.closest<
                HTMLAnchorElement
              >("a[data-note-link]");
              if (!anchor) return false;
              event.preventDefault();
              const href = anchor.getAttribute("href") ?? "";
              if (event.metaKey || event.ctrlKey) {
                window.open(href, "_blank", "noopener");
              } else {
                window.dispatchEvent(
                  new CustomEvent(NOTE_LINK_NAVIGATE_EVENT, { detail: href }),
                );
              }
              return true;
            },
          },
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain") ?? "";
            const match = INTERNAL_URL.exec(text.trim());
            if (!match) return false;
            const [, host, docId, blockId] = match;
            if (host && host !== window.location.host) return false;
            const type = view.state.schema.nodes.noteLink;
            if (!type) return false;
            const node = type.create({
              docId,
              blockId: blockId ?? null,
              label: "Linking…",
            });
            view.dispatch(view.state.tr.replaceSelectionWith(node, false));
            void fetchLinkLabel({ docId, blockId: blockId ?? null }).then(
              ({ label, missing }) => {
                if (editor.isDestroyed) return;
                const { state } = editor.view;
                const tr = state.tr;
                state.doc.descendants((n, pos) => {
                  if (
                    n.type.name === "noteLink" &&
                    n.attrs.docId === docId &&
                    n.attrs.label === "Linking…"
                  ) {
                    tr.setNodeMarkup(pos, undefined, {
                      ...n.attrs,
                      label: label || "Untitled note",
                      missing,
                    });
                  }
                });
                if (tr.docChanged) editor.view.dispatch(tr);
              },
            );
            return true;
          },
        },
      }),
    ];
  },
});
