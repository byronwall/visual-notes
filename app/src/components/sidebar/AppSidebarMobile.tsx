import type { Accessor, JSX } from "solid-js";
import { MenuIcon } from "lucide-solid";
import { AppSidebarContent } from "./AppSidebarContent";
import { IconButton } from "~/components/ui/icon-button";
import * as Drawer from "~/components/ui/drawer";
import { Box } from "styled-system/jsx";

type AppSidebarMobileProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCollapse: () => void;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onLogout: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
  authed: Accessor<boolean>;
  children: JSX.Element;
};

export const AppSidebarMobile = (props: AppSidebarMobileProps) => {
  return (
    <Box display={{ base: "block", md: "none" }} minH="100vh">
      <Drawer.Root
        open={props.open}
        onOpenChange={(details) => props.onOpenChange(details.open)}
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            bg="bg.subtle"
            borderColor="border"
            borderWidth="1px"
            w="75vw"
            maxW="320px"
            p="0"
          >
            <AppSidebarContent
              expanded={true}
              mode="mobile"
              onToggleCollapse={props.onToggleCollapse}
              onClose={() => props.onOpenChange(false)}
              onChatOpen={props.onChatOpen}
              onNewNoteOpen={props.onNewNoteOpen}
              onLogout={props.onLogout}
              hasUnreadAny={props.hasUnreadAny}
              hasLoadingAny={props.hasLoadingAny}
              authed={props.authed}
            />
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>

      <Box position="fixed" top="4" left="4" zIndex="50">
        <IconButton
          variant="outline"
          size="sm"
          colorPalette="gray"
          aria-label="Open sidebar"
          title="Open sidebar"
          onClick={() => props.onOpenChange(true)}
        >
          <MenuIcon size={18} />
        </IconButton>
      </Box>

      <Box minH="100vh">{props.children}</Box>
    </Box>
  );
};
