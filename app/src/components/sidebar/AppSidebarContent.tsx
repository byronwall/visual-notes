import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-solid";
import type { Accessor } from "solid-js";
import { Show } from "solid-js";
import { Box, HStack, VisuallyHidden } from "styled-system/jsx";
import { AppSidebarNav } from "./AppSidebarNav";
import { CloseButton } from "~/components/ui/close-button";
import { IconButton } from "~/components/ui/icon-button";
import { Image } from "~/components/ui/image";
import { Link } from "~/components/ui/link";
import { AppSidebarActions } from "./AppSidebarActions";
import { AppSidebarFooter } from "./AppSidebarFooter";
import { AppSidebarRecentDocs } from "./AppSidebarRecentDocs";

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

const AppSidebarSeparator = () => {
  return <Box borderTopWidth="1px" borderColor="border" mx="2" my="1" />;
};

export const AppSidebarContent = (props: AppSidebarContentProps) => {
  return (
    <Box
      as="nav"
      display="flex"
      flexDirection="column"
      h="100%"
      maxH="100vh"
      minH="0"
      overflowY="hidden"
      overflowX="hidden"
      px="2"
      py="3"
      gap="1"
    >
      <HStack gap="2" px="2" alignItems="center">
        <Link
          href="/"
          variant="plain"
          textDecorationLine="none"
          color="fg.default"
          borderRadius="l2"
          px="2"
          py="1"
          _hover={{
            textDecorationLine: "none",
            bg: "bg.muted",
            color: "fg.default",
          }}
          title="Visual Notes"
        >
          <HStack gap="2" alignItems="center">
            <Image
              src="/favicon-32x32.png"
              alt=""
              boxSize="7"
              fit="contain"
              borderRadius="l2"
            />
            <Show when={props.expanded}>
              <Box as="span" fontWeight="semibold" letterSpacing="tight">
                Visual Notes
              </Box>
            </Show>
            <Show when={!props.expanded}>
              <VisuallyHidden>Visual Notes</VisuallyHidden>
            </Show>
          </HStack>
        </Link>
        <Box flex="1" />
        <Show when={props.mode === "desktop"}>
          <IconButton
            variant="plain"
            size="xs"
            aria-label={props.expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={props.expanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={props.onToggleCollapse}
          >
            <Show
              when={props.expanded}
              fallback={<PanelLeftOpenIcon size={16} />}
            >
              <PanelLeftCloseIcon size={16} />
            </Show>
          </IconButton>
        </Show>
        <Show when={props.mode === "mobile"}>
          <CloseButton
            size="xs"
            aria-label="Close sidebar"
            title="Close sidebar"
            onClick={props.onClose}
          />
        </Show>
      </HStack>

      <AppSidebarNav expanded={props.expanded} />

      <AppSidebarSeparator />

      <AppSidebarActions
        expanded={props.expanded}
        onChatOpen={props.onChatOpen}
        onNewNoteOpen={props.onNewNoteOpen}
        onSearchOpen={props.onSearchOpen}
        hasUnreadAny={props.hasUnreadAny}
        hasLoadingAny={props.hasLoadingAny}
      />

      <AppSidebarSeparator />

      <Box flex="1" minH="0">
        <AppSidebarRecentDocs expanded={props.expanded} />
      </Box>

      <AppSidebarFooter
        expanded={props.expanded}
        authed={props.authed}
        onLogout={props.onLogout}
      />
    </Box>
  );
};
