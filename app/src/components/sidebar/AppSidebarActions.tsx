import type { Accessor, JSX } from "solid-js";
import { Show } from "solid-js";
import { BotMessageSquareIcon, FilePlusIcon, SearchIcon } from "lucide-solid";
import { Box, Stack } from "styled-system/jsx";
import type { SidebarNavIcon } from "./nav-items";
import {
  SidebarRailTooltip,
  sidebarRowClass,
  sidebarRowLabelClass,
  sidebarShortcutClass,
} from "./SidebarNavLink";

type AppSidebarActionsProps = {
  expanded: boolean;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onSearchOpen: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
};

const SidebarActionButton = (props: {
  expanded: boolean;
  label: string;
  shortcut: string;
  icon: SidebarNavIcon;
  onClick: () => void;
  status?: JSX.Element;
}) => (
  <SidebarRailTooltip
    expanded={props.expanded}
    label={`${props.label}  ${props.shortcut}`}
  >
    <button
      type="button"
      class={sidebarRowClass}
      data-collapsed={props.expanded ? undefined : ""}
      aria-label={props.label}
      aria-keyshortcuts={props.shortcut.replace("⌘", "Meta+")}
      onClick={() => props.onClick()}
    >
      <props.icon size={16} strokeWidth={1.8} />
      <Show when={props.expanded}>
        <Box as="span" class={sidebarRowLabelClass}>
          {props.label}
        </Box>
      </Show>
      {props.status}
      <Show when={props.expanded}>
        <Box as="kbd" class={sidebarShortcutClass}>
          {props.shortcut}
        </Box>
      </Show>
    </button>
  </SidebarRailTooltip>
);

export const AppSidebarActions = (props: AppSidebarActionsProps) => {
  const chatStatus = () =>
    props.hasUnreadAny()
      ? "unread"
      : props.hasLoadingAny()
        ? "loading"
        : undefined;

  return (
    <Stack gap="0.5">
      <SidebarActionButton
        expanded={props.expanded}
        label="Search"
        shortcut="⌘K"
        icon={SearchIcon}
        onClick={props.onSearchOpen}
      />
      <SidebarActionButton
        expanded={props.expanded}
        label="New note"
        shortcut="⌘D"
        icon={FilePlusIcon}
        onClick={props.onNewNoteOpen}
      />
      <SidebarActionButton
        expanded={props.expanded}
        label="Chat"
        shortcut="⌘I"
        icon={BotMessageSquareIcon}
        onClick={props.onChatOpen}
        status={
          <Show when={chatStatus()}>
            {(status) => (
              <Box
                as="span"
                role="status"
                aria-label={
                  status() === "unread" ? "Unread chat replies" : "Chat is responding"
                }
                title={
                  status() === "unread" ? "Unread chat replies" : "Chat is responding"
                }
                boxSize="2"
                borderRadius="full"
                flexShrink="0"
                bg={status() === "unread" ? "blue.9" : "amber.9"}
                position={props.expanded ? "static" : "absolute"}
                top="1.5"
                right="3"
                animation={status() === "loading" ? "pulse 1.6s ease-in-out infinite" : undefined}
              />
            )}
          </Show>
        }
      />
    </Stack>
  );
};
