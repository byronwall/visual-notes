import { useIsRouting } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Box } from "styled-system/jsx";

const SHOW_DELAY_MS = 120;

/**
 * Thin indeterminate bar pinned to the top edge while a route transition is
 * pending. Delayed so instant navigations never flash it. Overlays content,
 * so it never shifts layout.
 */
export const RouteProgressBar = () => {
  const isRouting = useIsRouting();
  const [visible, setVisible] = createSignal(false);

  createEffect(() => {
    if (!isRouting()) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  return (
    <Show when={visible()}>
      <Box
        role="progressbar"
        aria-label="Loading page"
        position="fixed"
        top="0"
        insetX="0"
        h="2px"
        zIndex="toast"
        overflow="hidden"
        pointerEvents="none"
      >
        <Box
          h="full"
          w="full"
          bg="blue.9"
          transformOrigin="left"
          animation="route-progress 1.1s ease-in-out infinite"
          _motionReduce={{ animation: "none", opacity: "0.6" }}
        />
      </Box>
    </Show>
  );
};
