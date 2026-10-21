import { A, useLocation } from "@solidjs/router";
import { For, type JSX } from "solid-js";
import { css } from "styled-system/css";
import { HStack } from "styled-system/jsx";

export const EVENTS_TABS = [
  { label: "Upcoming", href: "/events" },
  { label: "Calendar", href: "/events/calendar" },
  { label: "Map", href: "/events/map" },
  { label: "Places", href: "/events/places" },
  { label: "Feeds", href: "/events/feeds" },
] as const;

const tabClass = css({
  px: { base: "2", md: "3" },
  py: "1.5",
  flexShrink: 0,
  whiteSpace: "nowrap",
  borderRadius: "l2",
  fontSize: "sm",
  fontWeight: "medium",
  color: "fg.muted",
  textDecoration: "none",
  _hover: { bg: "bg.muted", color: "fg.default" },
  "&[aria-current=page]": { bg: "bg.emphasized", color: "fg.default" },
});

/** Section tabs shared by every /events page; `actions` sits at the right. */
export function EventsTabs(props: { actions?: JSX.Element }) {
  const location = useLocation();
  const isCurrent = (href: string) =>
    href === "/events"
      ? location.pathname === "/events"
      : location.pathname.startsWith(href);
  return (
    <HStack justify="space-between" gap="3" flexWrap="wrap" mb="4">
      <HStack
        as="nav"
        gap="0.5"
        aria-label="Events sections"
        minW="0"
        maxW="full"
        overflowX="auto"
      >
        <For each={EVENTS_TABS}>
          {(tab) => (
            <A
              href={tab.href}
              class={tabClass}
              aria-current={isCurrent(tab.href) ? "page" : undefined}
              end
            >
              {tab.label}
            </A>
          )}
        </For>
      </HStack>
      {props.actions}
    </HStack>
  );
}
