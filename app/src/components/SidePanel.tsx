import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** Optional explicit width. Accepts tailwind-like class or CSS length via style prop below. */
  class?: string;
  /** If true, pressing Escape closes the panel (default true) */
  closeOnEsc?: boolean;
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

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div class="absolute inset-0 bg-black/30" onClick={props.onClose} />
          {/* Panel */}
          <div
            class={`absolute inset-y-0 right-0 flex h-full max-h-full w-[min(90vw,480px)] bg-white shadow-xl border-l border-gray-200 ${
              props.class || ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex h-full w-full flex-col overflow-y-auto">
              {/* Header */}
              <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div class="font-medium text-gray-900">Details</div>
                <button
                  type="button"
                  class="rounded p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                  aria-label="Close panel"
                  onClick={props.onClose}
                >
                  ✕
                </button>
              </div>
              {/* Content */}
              <div class="px-4 py-4">{props.children}</div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
