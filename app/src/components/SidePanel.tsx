import {
  JSX,
  Show,
  Suspense,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
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

const ENTER_MS = 260;
const EXIT_MS = 180;
// Drawer curve for the entrance; a strong ease-out for the quicker exit.
const ENTER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const EXIT_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const motion = (open: boolean, properties: string[]) =>
  properties
    .map((property) =>
      open
        ? `${property} ${ENTER_MS}ms ${ENTER_EASE}`
        : `${property} ${EXIT_MS}ms ${EXIT_EASE}`,
    )
    .join(", ");

export const SidePanel = (props: SidePanelProps) => {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;
  const isModal = () => props.modal !== false;
  let panelElement: HTMLDivElement | undefined;

  // The panel stays mounted through its exit so it can slide out. `shown`
  // drives the CSS transition; flipping it a frame after mount gives the
  // browser a closed starting point, and transitions (unlike keyframes)
  // retarget smoothly when the panel is reopened mid-exit.
  const [mounted, setMounted] = createSignal(untrack(() => props.open));
  const [shown, setShown] = createSignal(untrack(() => props.open));
  createEffect(() => {
    if (props.open) {
      setMounted(true);
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setShown(true));
      });
      onCleanup(() => cancelAnimationFrame(frame));
      return;
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target;
      const targetDialog =
        target instanceof Element ? target.closest('[role="dialog"]') : null;
      if (targetDialog && targetDialog !== panelElement) return;
      // A portalled menu or popover from the panel closes itself first.
      if (
        target instanceof Element &&
        !panelElement?.contains(target) &&
        target.closest('[data-scope][data-part="content"]')
      ) {
        return;
      }
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
    <Show when={mounted()}>
      <Portal>
        <Box
          position="fixed"
          inset="0"
          zIndex="modal"
          overflow="hidden"
          overscrollBehavior="contain"
          pointerEvents={isModal() && props.open ? "auto" : "none"}
          data-state={shown() ? "open" : "closed"}
          aria-hidden={props.open ? undefined : "true"}
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
              style={{
                "backdrop-filter": "blur(6px)",
                opacity: shown() ? 1 : 0,
                transition: motion(shown(), ["opacity"]),
              }}
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
            data-side-panel-scroll
            bg="bg.default"
            borderLeftWidth="1px"
            borderColor="border"
            boxShadow="2xl"
            pointerEvents={props.open ? "auto" : "none"}
            willChange="transform"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: props.width || "min(94vw, 560px)",
              // Reduced motion keeps the fade and drops the slide.
              ...(prefersReducedMotion()
                ? {
                    opacity: shown() ? 1 : 0,
                    transition: motion(shown(), ["opacity"]),
                  }
                : {
                    transform: shown() ? "translateX(0)" : "translateX(100%)",
                    transition: motion(shown(), ["transform"]),
                  }),
            }}
          >
            <Suspense>{props.children}</Suspense>
          </Box>
        </Box>
      </Portal>
    </Show>
  );
};
