import { createSignal, onCleanup, onMount } from "solid-js";
import type { Editor } from "@tiptap/core";

export function useCodeBlockOverlay(
  editor: () => Editor | null,
  hostEl: () => HTMLElement | undefined
) {
  const [pos, setPos] = createSignal<{ top: number; left: number } | undefined>(
    undefined
  );

  const update = () => {
    const ed = editor();
    const host = hostEl();
    if (!ed || !host) return;
    if (!ed.isActive("codeBlock")) return setPos(undefined);

    // TODO:AS_ANY, Tiptap Editor hides ProseMirror view/state; we need nodeDOM + selection to locate code block
    const view = (ed as any).view as { nodeDOM: (pos: number) => Node | null };
    const state = (ed as any).state as { selection: any };
    const $from = state.selection.$from;
    let dom: HTMLElement | null = null;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node?.type?.name === "codeBlock") {
        const pos = $from.before(d);
        dom = (view.nodeDOM(pos) as HTMLElement) || null;
        break;
      }
    }
    if (!dom) return setPos(undefined);

    const pre = dom.matches("pre")
      ? dom
      : (dom.querySelector("pre") as HTMLElement | null);
    const target = pre || dom;

    const block = target.getBoundingClientRect();
    const wrap = host.getBoundingClientRect();
    const top = block.top - wrap.top + host.scrollTop - 8;
    const left = block.left - wrap.left + host.scrollLeft + 8;
    console.log("[overlay] pos:", { top, left });
    setPos({ top, left });
  };

  onMount(() => {
    const ed = editor();
    if (!ed) return;
    ed.on("selectionUpdate", update);
    ed.on("transaction", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    update();

    onCleanup(() => {
      ed?.off("selectionUpdate", update);
      ed?.off("transaction", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    });
  });

  return pos;
}
