import type { Accessor, JSX } from "solid-js";
import { For, Match, Show, Switch } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  LogInIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-solid";
import {
  cycleThemePreference,
  themePreference,
  themePreferenceLabel,
} from "~/lib/theme-mode";
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
  _hover: { bg: "bg.hover", color: "fg.default" },
  _active: { bg: "bg.active" },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "border.focus",
    outlineOffset: "-2px",
  },
  "&[aria-current=page]": { bg: "bg.selected", color: "fg.selected" },
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
      <FooterTip label={themePreferenceLabel(themePreference())}>
        <button
          type="button"
          class={footerIconClass}
          aria-label={`${themePreferenceLabel(themePreference())} (click to change)`}
          onClick={() => cycleThemePreference()}
        >
          <Switch>
            <Match when={themePreference() === "light"}>
              <SunIcon size={16} strokeWidth={1.8} />
            </Match>
            <Match when={themePreference() === "dark"}>
              <MoonIcon size={16} strokeWidth={1.8} />
            </Match>
            <Match when={themePreference() === "system"}>
              <MonitorIcon size={16} strokeWidth={1.8} />
            </Match>
          </Switch>
        </button>
      </FooterTip>
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
