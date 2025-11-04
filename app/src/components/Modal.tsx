import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export default function Modal(props: {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** Optional class applied to the content container */
  contentClass?: string;
  /** If true, pressing Escape closes the modal (default true) */
  closeOnEsc?: boolean;
  /** If true, clicking the backdrop keeps the modal open (default false, backdrop closes modal) */
  shouldKeepOpenOnBackdropClick?: boolean;
}) {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;
  const shouldCloseOnBackdrop = () =>
    props.shouldKeepOpenOnBackdropClick !== true;

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Lock background scroll while modal is open
  createEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    console.log("[Modal] Body scroll locked");
    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      console.log("[Modal] Body scroll unlocked");
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50 overflow-hidden overscroll-contain"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/0"
            onClick={() => {
              console.log("[Modal] Backdrop clicked");
              if (shouldCloseOnBackdrop()) props.onClose();
            }}
          />
          {/* Centered content wrapper */}
          <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              class={`${props.contentClass || "max-w-2xl w-full"} pointer-events-auto max-h-[90vh] overflow-auto bg-white border border-gray-200 rounded shadow-lg`}
              onClick={(e) => e.stopPropagation()}
            >
              {props.children}
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
