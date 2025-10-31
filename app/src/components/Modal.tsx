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
          {/* Backdrop is intentionally transparent for a subtle feel */}
          <div class="absolute inset-0 bg-black/0" />
          <div
            class={`${props.contentClass || ""} overscroll-contain`}
            onClick={() => {
              console.log("[Modal] Backdrop clicked");
              if (shouldCloseOnBackdrop()) {
                props.onClose();
              }
            }}
          >
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
