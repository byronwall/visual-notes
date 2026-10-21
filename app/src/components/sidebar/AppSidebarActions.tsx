import type { Accessor, JSX } from "solid-js";
import { Show } from "solid-js";
import {
  BotMessageSquareIcon,
  FilePlusIcon,
  MicIcon,
  SearchIcon,
} from "lucide-solid";
import { Box } from "styled-system/jsx";
import { Tooltip } from "~/components/ui/tooltip";
import type { SidebarNavIcon } from "./nav-items";
import {
  sidebarRowClass,
  sidebarRowLabelClass,
  sidebarShortcutClass,
} from "./SidebarNavLink";

type AppSidebarActionsProps = {
  expanded: boolean;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onVoiceNoteStart: () => void;
  onSearchOpen: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
};

/** Icon-only action with its label and shortcut in a tooltip. */
const SidebarIconAction = (props: {
  expanded: boolean;
  label: string;
  shortcut?: string;
  icon: SidebarNavIcon;
  onClick: () => void;
  status?: JSX.Element;
  statusLabel?: string;
}) => (
  <Tooltip
    content={[props.label, props.shortcut, props.statusLabel && `· ${props.statusLabel}`]
      .filter(Boolean)
      .join("  ")}
    openDelay={150}
    closeDelay={0}
    positioning={{ placement: props.expanded ? "bottom" : "right", gutter: 8 }}
  >
    <button
      type="button"
      class={sidebarRowClass}
      data-collapsed=""
      data-icon-only={props.expanded ? "" : undefined}
      aria-label={props.label}
      aria-keyshortcuts={props.shortcut?.replace("⌘", "Meta+")}
      onClick={() => props.onClick()}
    >
      <props.icon size={16} strokeWidth={1.8} />
      {props.status}
    </button>
  </Tooltip>
);

/**
 * Search, New note, Voice note, and Chat on one row: search is the wide
 * target, the rest are icons. The collapsed rail stacks all three as icons.
 */
export const AppSidebarActions = (props: AppSidebarActionsProps) => {
  const chatStatus = () =>
    props.hasUnreadAny()
      ? "unread"
      : props.hasLoadingAny()
        ? "loading"
        : undefined;

  return (
    <Box
      display="flex"
      flexDirection={props.expanded ? "row" : "column"}
      alignItems="center"
      gap="0.5"
    >
      <Show
        when={props.expanded}
        fallback={
          <SidebarIconAction
            expanded={false}
            label="Search"
            shortcut="⌘K"
            icon={SearchIcon}
            onClick={props.onSearchOpen}
          />
        }
      >
        <button
          type="button"
          class={sidebarRowClass}
          data-variant="field"
          aria-label="Search"
          aria-keyshortcuts="Meta+K"
          onClick={() => props.onSearchOpen()}
        >
          <SearchIcon size={16} strokeWidth={1.8} />
          <Box as="span" class={sidebarRowLabelClass}>
            Search
          </Box>
          <Box as="kbd" class={sidebarShortcutClass}>
            ⌘K
          </Box>
        </button>
      </Show>
      <SidebarIconAction
        expanded={props.expanded}
        label="New note"
        shortcut="⌘D"
        icon={FilePlusIcon}
        onClick={props.onNewNoteOpen}
      />
      <SidebarIconAction
        expanded={props.expanded}
        label="Voice note"
        icon={MicIcon}
        onClick={props.onVoiceNoteStart}
      />
      <SidebarIconAction
        expanded={props.expanded}
        label="Chat"
        shortcut="⌘I"
        icon={BotMessageSquareIcon}
        onClick={props.onChatOpen}
        statusLabel={
          chatStatus() === "unread"
            ? "Unread replies"
            : chatStatus() === "loading"
              ? "Responding…"
              : undefined
        }
        status={
          <Show when={chatStatus()}>
            {(status) => (
              <Box
                as="span"
                role="status"
                aria-label={
                  status() === "unread" ? "Unread chat replies" : "Chat is responding"
                }
                boxSize="2"
                borderRadius="full"
                position="absolute"
                top="1"
                right="1"
                bg={status() === "unread" ? "blue.9" : "amber.9"}
                animation={status() === "loading" ? "pulse 1.6s ease-in-out infinite" : undefined}
              />
            )}
          </Show>
        }
      />
    </Box>
  );
};
