import type { Accessor } from "solid-js";
import { useLocation } from "@solidjs/router";
import { FilePlusIcon, MenuIcon, SearchIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import * as Drawer from "~/components/ui/drawer";
import { AppSidebarContent } from "./AppSidebarContent";
import { sectionTitleForPath } from "./nav-items";

type AppSidebarMobileProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCollapse: () => void;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onSearchOpen: () => void;
  onLogout: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
  authed: Accessor<boolean>;
};

const barButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "10",
  flexShrink: "0",
  borderRadius: "l2",
  color: "fg.muted",
  bg: "transparent",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3", color: "fg.default" },
  _active: { bg: "gray.a4" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "blue.9",
    outlineOffset: "-2px",
  },
});

/**
 * Phone-width app bar: menu (opens the sidebar drawer), current section,
 * and the two most-used actions so they never need the drawer.
 */
export const AppSidebarMobile = (props: AppSidebarMobileProps) => {
  const location = useLocation();
  let openButton: HTMLButtonElement | undefined;
  const sectionTitle = () =>
    sectionTitleForPath(location.pathname) ?? "Visual Notes";

  return (
    <Box display={{ base: "block", md: "none" }}>
      <Box
        as="header"
        position="fixed"
        top="0"
        insetX="0"
        zIndex="sticky"
        h="12"
        px="1"
        display="flex"
        alignItems="center"
        gap="1"
        bg="gray.2"
        borderBottomWidth="1px"
        borderColor="border"
      >
        <button
          type="button"
          ref={(element) => (openButton = element)}
          class={barButtonClass}
          aria-label="Open menu"
          aria-expanded={props.open}
          onClick={() => props.onOpenChange(true)}
        >
          <MenuIcon size={20} strokeWidth={1.8} />
        </button>
        <Box
          flex="1"
          minW="0"
          fontSize="sm"
          fontWeight="semibold"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {sectionTitle()}
        </Box>
        <button
          type="button"
          class={barButtonClass}
          aria-label="Search"
          onClick={() => props.onSearchOpen()}
        >
          <SearchIcon size={18} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          class={barButtonClass}
          aria-label="New note"
          onClick={() => props.onNewNoteOpen()}
        >
          <FilePlusIcon size={18} strokeWidth={1.8} />
        </button>
      </Box>
      <Drawer.Root
        open={props.open}
        onOpenChange={(details) => props.onOpenChange(details.open)}
        finalFocusEl={() => openButton ?? null}
        placement="start"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content w="82vw" maxW="300px" p="0" bg="gray.2">
            <AppSidebarContent
              expanded={true}
              mode="mobile"
              onToggleCollapse={props.onToggleCollapse}
              onClose={() => props.onOpenChange(false)}
              onChatOpen={props.onChatOpen}
              onNewNoteOpen={props.onNewNoteOpen}
              onSearchOpen={props.onSearchOpen}
              onLogout={props.onLogout}
              hasUnreadAny={props.hasUnreadAny}
              hasLoadingAny={props.hasLoadingAny}
              authed={props.authed}
            />
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </Box>
  );
};
