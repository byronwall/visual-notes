import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { ImagePreviewModal } from "./ImagePreviewModal";

type PreviewState = {
  open: boolean;
  images: string[];
  index: number;
  alt?: string;
  title?: string;
};

const [preview, setPreview] = createSignal<PreviewState>({
  open: false,
  images: [],
  index: 0,
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
        images={preview().images}
        initialIndex={preview().index}
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
    images: [args.src],
    index: 0,
    alt: args.alt,
    title: args.title,
  });
}

export function openImagePreviewCarousel(args: {
  images: string[];
  index?: number;
  alt?: string;
  title?: string;
}) {
  const images = args.images
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  if (!images.length) return;

  ensurePreviewHost();
  setPreview({
    open: true,
    images,
    index: Math.max(0, Math.min(args.index ?? 0, images.length - 1)),
    alt: args.alt,
    title: args.title,
  });
}
