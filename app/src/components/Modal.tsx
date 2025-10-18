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
}) {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onClick={props.onClose}
        >
          {/* Backdrop is intentionally transparent for a subtle feel */}
          <div class="absolute inset-0 bg-black/0" />
          <div class={props.contentClass || ""}>{props.children}</div>
        </div>
      </Portal>
    </Show>
  );
}
