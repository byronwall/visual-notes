import {
  JSX,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export const Popover = (props: {
  open: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  placement?: Placement;
  offset?: number;
  class?: string;
  children: JSX.Element;
}) => {
  const [position, setPosition] = createSignal<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  let popoverEl: HTMLDivElement | undefined;

  const getPlacement = () => props.placement || "bottom-start";
  const getOffset = () => (typeof props.offset === "number" ? props.offset : 8);

  const recomputePosition = () => {
    const anchor = props.anchorEl as HTMLElement | null | undefined;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const offset = getOffset();
    let top = rect.bottom + offset;
    let left = rect.left;
    const placement = getPlacement();
    if (placement === "bottom-end") {
      left = rect.right;
    } else if (placement === "top-start" || placement === "top-end") {
      top = rect.top - offset; // will adjust vertically using transform
    }
    setPosition({ top, left });
  };

  const handleGlobalMouseDown = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (!props.open) return;
    if (!target) return;
    const anchor = props.anchorEl as HTMLElement | null | undefined;
    const isInPopover = !!popoverEl && popoverEl.contains(target);
    const isInAnchor = !!anchor && anchor.contains(target as Node);
    if (!isInPopover && !isInAnchor) {
      console.log("[Popover] Outside click – closing");
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.open) return;
    if (e.key === "Escape") {
      console.log("[Popover] ESC pressed – closing");
      props.onClose();
    }
  };

  createEffect(() => {
    if (!props.open) return;
    recomputePosition();
  });

  onMount(() => {
    window.addEventListener("scroll", recomputePosition, true);
    window.addEventListener("resize", recomputePosition, true);
    document.addEventListener("mousedown", handleGlobalMouseDown, true);
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("scroll", recomputePosition, true);
      window.removeEventListener("resize", recomputePosition, true);
      document.removeEventListener("mousedown", handleGlobalMouseDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={(el) => (popoverEl = el)}
          class={`fixed z-50 rounded border border-gray-300 bg-white shadow-lg ${
            props.class || ""
          }`}
          style={{
            top: `${position().top}px`,
            left: `${position().left}px`,
            transform: getPlacement().startsWith("top")
              ? "translateY(-100%)"
              : "translateY(0)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
};
