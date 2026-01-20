import type { Accessor, JSX } from "solid-js";
import { AppSidebarContent } from "./AppSidebarContent";
import { Box } from "styled-system/jsx";

type AppSidebarDesktopProps = {
  expanded: boolean;
  collapsedWidth: string;
  expandedWidth: string;
  onSidebarMouseEnter: () => void;
  onSidebarMouseLeave: () => void;
  onToggleCollapse: () => void;
  onClose: () => void;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onLogout: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
  authed: Accessor<boolean>;
  children: JSX.Element;
};

export const AppSidebarDesktop = (props: AppSidebarDesktopProps) => {
  const sidebarWidth = () =>
    props.expanded ? props.expandedWidth : props.collapsedWidth;

  return (
    <Box display={{ base: "none", md: "block" }}>
      <Box minH="100vh" bg="bg.default" w="full">
        <Box
          position="fixed"
          top="0"
          left="0"
          zIndex="40"
          w={sidebarWidth()}
          h="100vh"
          maxH="100vh"
          bg="bg.subtle"
          overflow="hidden"
          borderRightWidth="1px"
          borderColor="border"
          onMouseEnter={props.onSidebarMouseEnter}
          onMouseLeave={props.onSidebarMouseLeave}
        >
          <AppSidebarContent
            expanded={props.expanded}
            mode="desktop"
            onToggleCollapse={props.onToggleCollapse}
            onClose={props.onClose}
            onChatOpen={props.onChatOpen}
            onNewNoteOpen={props.onNewNoteOpen}
            onLogout={props.onLogout}
            hasUnreadAny={props.hasUnreadAny}
            hasLoadingAny={props.hasLoadingAny}
            authed={props.authed}
          />
        </Box>
        <Box minW="0" minH="100vh" bg="bg.default" ml={sidebarWidth()}>
          {props.children}
        </Box>
      </Box>
    </Box>
  );
};
