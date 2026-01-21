import Image from "@tiptap/extension-image";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { ImagePreviewModal } from "../ui/ImagePreviewModal";

export const CustomImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      img.draggable = true;
      img.src = String(node.attrs.src || "");
      if (node.attrs.alt) img.alt = String(node.attrs.alt);
      if (node.attrs.title) img.title = String(node.attrs.title);
      // Preserve ProseMirror's selection styling behavior:
      // it applies `ProseMirror-selectednode` to the node view's `dom`.
      // Returning the <img> itself ensures the class lands on the image.
      img.classList.add("vn-image");

      let host: HTMLDivElement | null = null;
      let dispose: (() => void) | null = null;
      let setOpen: ((v: boolean) => void) | null = null;
      let setSrc: ((v: string) => void) | null = null;
      let setAlt: ((v: string) => void) | null = null;
      let setTitle: ((v: string | undefined) => void) | null = null;

      const ensureModal = () => {
        if (dispose) return;
        host = document.createElement("div");
        document.body.appendChild(host);

        dispose = render(() => {
          const [open, _setOpen] = createSignal(false);
          const [src, _setSrc] = createSignal(String(node.attrs.src || ""));
          const [alt, _setAlt] = createSignal(String(node.attrs.alt || ""));
          const [title, _setTitle] = createSignal<string | undefined>(
            node.attrs.title ? String(node.attrs.title) : undefined
          );

          setOpen = _setOpen;
          setSrc = _setSrc;
          setAlt = _setAlt;
          setTitle = _setTitle;

          return (
            <ImagePreviewModal
              open={open()}
              src={src()}
              alt={alt()}
              title={title()}
              onClose={() => _setOpen(false)}
            />
          );
        }, host);
      };

      const openModal = () => {
        ensureModal();
        console.log("[image] open preview:", img.src);
        setOpen?.(true);
      };

      const onDblClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      };

      img.addEventListener("dblclick", onDblClick);

      return {
        dom: img,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;
          const nextSrc = String(updatedNode.attrs.src || "");
          const nextAlt = String(updatedNode.attrs.alt || "");
          const nextTitle = updatedNode.attrs.title
            ? String(updatedNode.attrs.title)
            : undefined;

          if (img.src !== nextSrc) img.src = nextSrc;
          img.alt = nextAlt;
          if (nextTitle) img.title = nextTitle;
          else img.removeAttribute("title");

          setSrc?.(nextSrc);
          setAlt?.(nextAlt);
          setTitle?.(nextTitle);
          return true;
        },
        destroy: () => {
          img.removeEventListener("dblclick", onDblClick);
          setOpen?.(false);
          dispose?.();
          if (host) host.remove();
          host = null;
          dispose = null;
          setOpen = null;
          setSrc = null;
          setAlt = null;
          setTitle = null;
        },
      };
    };
  },
});

