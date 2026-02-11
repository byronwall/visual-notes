import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { ImagePreviewModal } from "./ImagePreviewModal";

type PreviewState = {
  open: boolean;
  src: string;
  alt?: string;
  title?: string;
};

const [preview, setPreview] = createSignal<PreviewState>({
  open: false,
  src: "",
});

let dispose: (() => void) | null = null;

function ensurePreviewHost() {
  if (dispose || typeof document === "undefined") return;
  const host = document.createElement("div");
  document.body.appendChild(host);

  dispose = render(
    () => (
      <ImagePreviewModal
        open={preview().open}
        src={preview().src}
        alt={preview().alt}
        title={preview().title}
        onClose={() => setPreview((current) => ({ ...current, open: false }))}
      />
    ),
    host
  );
}

export function openImagePreview(args: { src: string; alt?: string; title?: string }) {
  ensurePreviewHost();
  setPreview({
    open: true,
    src: args.src,
    alt: args.alt,
    title: args.title,
  });
}
