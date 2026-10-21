import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Tooltip } from "~/components/ui/tooltip";
import { AppSidebarActions } from "./AppSidebarActions";
import { AppSidebarFooter } from "./AppSidebarFooter";
import { AppSidebarNav } from "./AppSidebarNav";
import { AppSidebarRecent } from "./AppSidebarRecent";

export type AppSidebarContentProps = {
  expanded: boolean;
  mode: "desktop" | "mobile";
  onToggleCollapse: () => void;
  onClose: () => void;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onSearchOpen: () => void;
  onLogout: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
  authed: Accessor<boolean>;
};

const headerIconButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "8",
  flexShrink: "0",
  borderRadius: "l2",
  color: "fg.subtle",
  bg: "transparent",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  transitionTimingFunction: "ease-out",
  _hover: { bg: "gray.a3", color: "fg.default" },
  _active: { bg: "gray.a4" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "blue.9",
    outlineOffset: "-2px",
  },
});

const brandLinkClass = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  minW: "0",
  flex: "1",
  h: "8",
  px: "1.5",
  borderRadius: "l2",
  color: "fg.default",
  fontWeight: "semibold",
  fontSize: "sm",
  letterSpacing: "tight",
  textDecorationLine: "none",
  _hover: { bg: "gray.a3", textDecorationLine: "none" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "blue.9",
    outlineOffset: "-2px",
  },
});

export const AppSidebarContent = (props: AppSidebarContentProps) => {
  const isMobile = () => props.mode === "mobile";
  const closeIfMobile = () => {
    if (isMobile()) props.onClose();
  };

  return (
    <Box
      as="nav"
      aria-label="Main"
      display="flex"
      flexDirection="column"
      h="100%"
      maxH="100dvh"
      minH="0"
      overflowX="hidden"
      px="2"
      pt="2"
      pb="2"
      gap="2"
    >
      <HStack
        gap="1"
        alignItems="center"
        justifyContent={props.expanded ? "space-between" : "center"}
      >
        <Show when={props.expanded}>
          <a href="/" class={brandLinkClass}>
            <img
              src="/favicon-32x32.png"
              alt=""
              width="20"
              height="20"
              class={css({ borderRadius: "l1", flexShrink: "0" })}
            />
            <span>Visual Notes</span>
          </a>
        </Show>
        <Show
          when={isMobile()}
          fallback={
            <Tooltip
              content={props.expanded ? "Collapse sidebar  ⌘\\" : "Expand sidebar  ⌘\\"}
              openDelay={300}
              closeDelay={0}
              positioning={{ placement: "right", gutter: 8 }}
            >
              <button
                type="button"
                class={headerIconButtonClass}
                aria-label={props.expanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-keyshortcuts="Meta+\\"
                aria-expanded={props.expanded}
                onClick={() => props.onToggleCollapse()}
              >
                <Show
                  when={props.expanded}
                  fallback={<PanelLeftOpenIcon size={16} strokeWidth={1.8} />}
                >
                  <PanelLeftCloseIcon size={16} strokeWidth={1.8} />
                </Show>
              </button>
            </Tooltip>
          }
        >
          <button
            type="button"
            class={headerIconButtonClass}
            aria-label="Close menu"
            onClick={() => props.onClose()}
          >
            <XIcon size={16} strokeWidth={1.8} />
          </button>
        </Show>
      </HStack>

      <AppSidebarActions
        expanded={props.expanded}
        showShortcuts={!isMobile()}
        onChatOpen={() => {
          closeIfMobile();
          props.onChatOpen();
        }}
        onNewNoteOpen={() => {
          closeIfMobile();
          props.onNewNoteOpen();
        }}
        onSearchOpen={() => {
          closeIfMobile();
          props.onSearchOpen();
        }}
        hasUnreadAny={props.hasUnreadAny}
        hasLoadingAny={props.hasLoadingAny}
      />

      <AppSidebarNav expanded={props.expanded} />

      <Box flex="1" minH="0" display="flex" flexDirection="column">
        <AppSidebarRecent expanded={props.expanded} />
      </Box>

      <AppSidebarFooter
        expanded={props.expanded}
        authed={props.authed}
        onLogout={props.onLogout}
      />
    </Box>
  );
};
