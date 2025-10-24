import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** Optional extra classes to apply to the panel container (e.g., width) */
  class?: string;
  /** If true, pressing Escape closes the panel (default true) */
  closeOnEsc?: boolean;
  /** ARIA label for the dialog container */
  ariaLabel?: string;
};

export default function SidePanel(props: SidePanelProps) {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Lock background scroll while panel is open
  createEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    console.log("[SidePanel] Body scroll locked");
    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
      console.log("[SidePanel] Body scroll unlocked");
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50 overflow-hidden overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-label={props.ariaLabel || "Side panel"}
        >
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
            onClick={props.onClose}
          />
          {/* Panel shell (layout-only) */}
          <div
            class={`absolute inset-y-0 right-0 flex h-full max-h-full w-[min(94vw,560px)] bg-white/98 backdrop-blur shadow-2xl border-l border-gray-200 ${
              props.class || ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scroll container for consumer content */}
            <div class="flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-white">
              {props.children}
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
