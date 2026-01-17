import { JSX, Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";

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
        <Box
          position="fixed"
          inset="0"
          zIndex="50"
          overflow="hidden"
          overscrollBehavior="contain"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <Box
            position="absolute"
            inset="0"
            bg="black.a3"
            onClick={() => {
              console.log("[Modal] Backdrop clicked");
              if (shouldCloseOnBackdrop()) props.onClose();
            }}
          />
          {/* Centered content wrapper */}
          <Box
            position="absolute"
            inset="0"
            display="flex"
            alignItems="center"
            justifyContent="center"
            p="1rem"
            pointerEvents="none"
          >
            <Box
              class={props.contentClass}
              width="100%"
              maxW={props.contentClass ? undefined : "42rem"}
              pointerEvents="auto"
              maxH="90vh"
              overflow="auto"
              bg="white"
              borderWidth="1px"
              borderColor="gray.outline.border"
              borderRadius="l2"
              boxShadow="lg"
              onClick={(e) => e.stopPropagation()}
            >
              {props.children}
            </Box>
          </Box>
        </Box>
      </Portal>
    </Show>
  );
}
