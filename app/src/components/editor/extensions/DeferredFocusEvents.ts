import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

const deferredFocusEventsKey = new PluginKey("deferredFocusEvents");

/**
 * Replaces TipTap's core `focusEvents` extension.
 *
 * On iOS and Android, TipTap's `focus` command calls `view.dom.focus()`
 * synchronously while it is still building its own transaction. The core
 * extension dispatches a focus transaction from inside that DOM event, so
 * the command's transaction is stale by the time it is dispatched and
 * ProseMirror throws "Applying a mismatched transaction". Deferring the
 * focus/blur transaction to a microtask lets the command finish first; the
 * editor's `focus`/`blur` events still fire, just after the command.
 */
export const DeferredFocusEvents = Extension.create({
  name: "deferredFocusEvents",

  addProseMirrorPlugins() {
    const { editor } = this;
    const dispatchLater = (meta: "focus" | "blur", event: Event) => {
      queueMicrotask(() => {
        if (editor.isDestroyed) return;
        editor.view.dispatch(
          editor.state.tr
            .setMeta(meta, { event })
            .setMeta("addToHistory", false),
        );
      });
    };

    return [
      new Plugin({
        key: deferredFocusEventsKey,
        props: {
          handleDOMEvents: {
            focus: (_view, event) => {
              editor.isFocused = true;
              dispatchLater("focus", event);
              return false;
            },
            blur: (_view, event) => {
              editor.isFocused = false;
              dispatchLater("blur", event);
              return false;
            },
          },
        },
      }),
    ];
  },
});
