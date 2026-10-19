import { For } from "solid-js";
import { useLocation } from "@solidjs/router";
import { Stack } from "styled-system/jsx";
import { AppSidebarCanvasMenu } from "./AppSidebarCanvasMenu";
import { NOTES_DESTINATION, PRIMARY_DESTINATIONS } from "./nav-items";
import { SidebarNavLink } from "./SidebarNavLink";

type AppSidebarNavProps = {
  expanded: boolean;
};

export const AppSidebarNav = (props: AppSidebarNavProps) => {
  const location = useLocation();
  const pathname = () => location.pathname;

  return (
    <Stack as="ul" gap="0.5" listStyle="none" m="0" p="0" aria-label="Sections">
      <li>
        <SidebarNavLink
          expanded={props.expanded}
          active={NOTES_DESTINATION.isActive(pathname())}
          label={NOTES_DESTINATION.label}
          href={NOTES_DESTINATION.href}
          icon={NOTES_DESTINATION.icon}
        />
      </li>
      <li>
        <AppSidebarCanvasMenu
          expanded={props.expanded}
          pathname={pathname()}
        />
      </li>
      <For each={PRIMARY_DESTINATIONS}>
        {(item) => (
          <li>
            <SidebarNavLink
              expanded={props.expanded}
              active={item.isActive(pathname())}
              label={item.label}
              href={item.href}
              icon={item.icon}
            />
          </li>
        )}
      </For>
    </Stack>
  );
};
