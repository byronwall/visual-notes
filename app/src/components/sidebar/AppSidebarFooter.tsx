import type { Accessor, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { LogInIcon, LogOutIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Tooltip } from "~/components/ui/tooltip";
import { UTILITY_DESTINATIONS } from "./nav-items";

type AppSidebarFooterProps = {
  expanded: boolean;
  authed: Accessor<boolean>;
  onLogout: () => void;
};

const footerIconClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "8",
  borderRadius: "l2",
  color: "fg.muted",
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
  "&[aria-current=page]": { bg: "gray.a3", color: "fg.default" },
  "&[data-danger]:hover": { bg: "red.a3", color: "red.11" },
});

const FooterTip = (props: { label: string; children: JSX.Element }) => (
  <Tooltip
    content={props.label}
    openDelay={150}
    closeDelay={0}
    positioning={{ placement: "top" }}
  >
    {props.children}
  </Tooltip>
);

export const AppSidebarFooter = (props: AppSidebarFooterProps) => {
  const location = useLocation();
  const visibleDestinations = () =>
    UTILITY_DESTINATIONS.filter(
      (item) => item.href !== "/admin" || props.authed()
    );

  return (
    <Box
      display="flex"
      flexDirection={props.expanded ? "row" : "column"}
      alignItems="center"
      gap="0.5"
      pt="2"
      px={props.expanded ? "1" : "0"}
    >
      <For each={visibleDestinations()}>
        {(item) => (
          <FooterTip label={item.label}>
            <a
              href={item.href}
              class={footerIconClass}
              aria-label={item.label}
              aria-current={item.isActive(location.pathname) ? "page" : undefined}
            >
              <item.icon size={16} strokeWidth={1.8} />
            </a>
          </FooterTip>
        )}
      </For>
      <Box flex={props.expanded ? "1" : undefined} />
      <Show
        when={props.authed()}
        fallback={
          <FooterTip label="Sign in">
            <a href="/login" class={footerIconClass} aria-label="Sign in">
              <LogInIcon size={16} strokeWidth={1.8} />
            </a>
          </FooterTip>
        }
      >
        <FooterTip label="Sign out">
          <button
            type="button"
            class={footerIconClass}
            data-danger=""
            aria-label="Sign out"
            onClick={() => props.onLogout()}
          >
            <LogOutIcon size={16} strokeWidth={1.8} />
          </button>
        </FooterTip>
      </Show>
    </Box>
  );
};
