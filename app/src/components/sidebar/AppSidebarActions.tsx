import type { Accessor, JSX } from "solid-js";
import { Show } from "solid-js";
import { BotMessageSquareIcon, FilePlusIcon, SearchIcon } from "lucide-solid";
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
  /** Keyboard hints are noise in the touch drawer. */
  showShortcuts: boolean;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onSearchOpen: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
};

/** Icon-only action with its label and shortcut in a tooltip. */
const SidebarIconAction = (props: {
  expanded: boolean;
  showShortcuts: boolean;
  label: string;
  shortcut: string;
  icon: SidebarNavIcon;
  onClick: () => void;
  status?: JSX.Element;
}) => (
  <Tooltip
    content={props.showShortcuts ? `${props.label}  ${props.shortcut}` : props.label}
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
      aria-keyshortcuts={props.shortcut.replace("⌘", "Meta+")}
      onClick={() => props.onClick()}
    >
      <props.icon size={16} strokeWidth={1.8} />
      {props.status}
    </button>
  </Tooltip>
);

/**
 * Search, New note, and Chat on one row: search is the wide target, the other
 * two are icons. The collapsed rail stacks all three as icons.
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
            showShortcuts={props.showShortcuts}
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
          <Show when={props.showShortcuts}>
            <Box as="kbd" class={sidebarShortcutClass}>
              ⌘K
            </Box>
          </Show>
        </button>
      </Show>
      <SidebarIconAction
        expanded={props.expanded}
        showShortcuts={props.showShortcuts}
        label="New note"
        shortcut="⌘D"
        icon={FilePlusIcon}
        onClick={props.onNewNoteOpen}
      />
      <SidebarIconAction
        expanded={props.expanded}
        showShortcuts={props.showShortcuts}
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
