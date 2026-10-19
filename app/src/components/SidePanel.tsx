import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";
import { acquireBodyScrollLock } from "./overlay/bodyScrollLock";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** If true, pressing Escape closes the panel (default true) */
  closeOnEsc?: boolean;
  /** ARIA label for the dialog container */
  ariaLabel?: string;
  /** Optional width override */
  width?: string;
  /**
   * Modal panels dim and block the page behind them (default). Non-modal
   * panels leave the page interactive, e.g. to keep exploring a canvas.
   */
  modal?: boolean;
};

export const SidePanel = (props: SidePanelProps) => {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;
  const isModal = () => props.modal !== false;
  let panelElement: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target;
      const targetDialog =
        target instanceof Element ? target.closest('[role="dialog"]') : null;
      if (targetDialog && targetDialog !== panelElement) return;
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Lock background scroll while panel is open
  createEffect(() => {
    if (!props.open || !isModal()) return;
    const release = acquireBodyScrollLock();
    onCleanup(release);
  });

  return (
    <Show when={props.open}>
      <Portal>
        <Box
          position="fixed"
          inset="0"
          zIndex="50"
          overflow="hidden"
          overscrollBehavior="contain"
          pointerEvents={isModal() ? "auto" : "none"}
          role="dialog"
          aria-modal={isModal() ? "true" : "false"}
          aria-label={props.ariaLabel || "Side panel"}
          ref={panelElement}
        >
          <Show when={isModal()}>
            <Box
              position="absolute"
              inset="0"
              bg="black.a3"
              onClick={props.onClose}
              style={{ "backdrop-filter": "blur(6px)" }}
            />
          </Show>
          <Box
            position="absolute"
            insetY="0"
            right="0"
            display="flex"
            flexDirection="column"
            h="full"
            maxH="full"
            overflowY="auto"
            overscrollBehavior="contain"
            bg="bg.default"
            borderLeftWidth="1px"
            borderColor="border"
            boxShadow="2xl"
            pointerEvents="auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: props.width || "min(94vw, 560px)",
              "backdrop-filter": "blur(10px)",
            }}
          >
            {props.children}
          </Box>
        </Box>
      </Portal>
    </Show>
  );
};
