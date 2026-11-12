import { A, useLocation } from "@solidjs/router";
import { For } from "solid-js";
import { css } from "styled-system/css";

export const PEOPLE_TABS = [
  { label: "People", href: "/people" },
  { label: "Organizations", href: "/people/organizations" },
];

const bar = css({
  display: "flex",
  gap: "1",
  mb: "4",
  borderBottomWidth: "1px",
  borderColor: "border",
});
const tab = css({
  px: "3",
  py: "1.5",
  fontSize: "sm",
  color: "fg.muted",
  textDecoration: "none",
  borderBottomWidth: "2px",
  borderColor: "transparent",
  mb: "-1px",
  _hover: { color: "fg.default" },
  "&[aria-current=page]": {
    color: "fg.default",
    borderColor: "fg.default",
    fontWeight: "medium",
  },
});

/** Section tabs for the People area. */
export function PeopleTabs() {
  const location = useLocation();
  const active = (href: string) =>
    href === "/people"
      ? location.pathname === "/people"
      : location.pathname.startsWith(href);
  return (
    <nav class={bar} aria-label="People sections">
      <For each={PEOPLE_TABS}>
        {(t) => (
          <A
            href={t.href}
            class={tab}
            aria-current={active(t.href) ? "page" : undefined}
          >
            {t.label}
          </A>
        )}
      </For>
    </nav>
  );
}
