import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";

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
};

export const SidePanel = (props: SidePanelProps) => {
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
        <Box
          position="fixed"
          inset="0"
          zIndex="50"
          overflow="hidden"
          overscrollBehavior="contain"
          role="dialog"
          aria-modal="true"
          aria-label={props.ariaLabel || "Side panel"}
        >
          <Box
            position="absolute"
            inset="0"
            bg="black.a3"
            onClick={props.onClose}
            style={{ "backdrop-filter": "blur(6px)" }}
          />
          <Box
            position="absolute"
            insetY="0"
            right="0"
            display="flex"
            h="full"
            maxH="full"
            bg="bg.default"
            borderLeftWidth="1px"
            borderColor="border"
            boxShadow="2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: props.width || "min(94vw, 560px)",
              background: "rgba(255,255,255,0.98)",
              "backdrop-filter": "blur(10px)",
            }}
          >
            <Box
              display="flex"
              h="full"
              w="full"
              flexDirection="column"
              overflowY="auto"
              overscrollBehavior="contain"
              bg="bg.default"
            >
              {props.children}
            </Box>
          </Box>
        </Box>
      </Portal>
    </Show>
  );
};
