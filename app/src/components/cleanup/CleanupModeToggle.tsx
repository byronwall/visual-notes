import type { VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";

const segment = css({
  px: "3",
  py: "1",
  fontSize: "sm",
  borderRadius: "l1",
  color: "fg.muted",
  _hover: { color: "fg.default" },
  "&[aria-current=page]": {
    bg: "bg.default",
    color: "fg.default",
    boxShadow: "xs",
  },
});

/** Daily (one card at a time) vs Deep pass (the three-pane triage). */
export const CleanupModeToggle: VoidComponent<{ mode: "daily" | "deep" }> = (
  props,
) => (
  <HStack
    as="nav"
    aria-label="Cleanup mode"
    gap="0.5"
    p="0.5"
    bg="gray.a3"
    borderRadius="l2"
    w="fit-content"
    data-testid="cleanup-mode"
  >
    <a
      href="/cleanup?mode=daily"
      class={segment}
      aria-current={props.mode === "daily" ? "page" : undefined}
    >
      Daily
    </a>
    <a
      href="/cleanup"
      class={segment}
      aria-current={props.mode === "deep" ? "page" : undefined}
    >
      Deep pass
    </a>
  </HStack>
);
