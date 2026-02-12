import Image from "@tiptap/extension-image";
import { createMemo } from "solid-js";
import { createSolidNodeViewRenderer, NodeViewWrapper, useSolidNodeView } from "../nodeviews";
import { openImagePreview } from "../ui/imagePreviewService";

type ImageAttrs = {
  src?: string;
  alt?: string;
  title?: string;
};

function CustomImageNodeView() {
  const { state } = useSolidNodeView<ImageAttrs>();

  const src = createMemo(() => String(state().node.attrs.src || ""));
  const alt = createMemo(() => String(state().node.attrs.alt || ""));
  const title = createMemo(() => {
    const value = state().node.attrs.title;
    return value ? String(value) : undefined;
  });

  const onDblClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openImagePreview({ src: src(), alt: alt(), title: title() });
  };

  return (
    <NodeViewWrapper
      as="img"
      class="vn-image"
      draggable
      src={src()}
      alt={alt()}
      title={title()}
      onDblClick={onDblClick}
      data-node-view-image="true"
    />
  );
}

export const CustomImage = Image.extend({
  addNodeView() {
    return createSolidNodeViewRenderer(CustomImageNodeView);
  },
});
