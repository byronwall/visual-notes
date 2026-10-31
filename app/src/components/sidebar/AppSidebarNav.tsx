import { For } from "solid-js";
import { useLocation } from "@solidjs/router";
import { Grid } from "styled-system/jsx";
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
    // Two columns when expanded: ten sections in five short rows, so the
    // Recent list starts high in the sidebar.
    <Grid
      as="ul"
      gridTemplateColumns={props.expanded ? "repeat(2, minmax(0, 1fr))" : "1fr"}
      columnGap="0.5"
      rowGap="0.5"
      listStyle="none"
      m="0"
      p="0"
      aria-label="Sections"
    >
      <li>
        <SidebarNavLink
          expanded={props.expanded}
          active={NOTES_DESTINATION.isActive(pathname())}
          label={NOTES_DESTINATION.label}
          href={NOTES_DESTINATION.href}
          icon={NOTES_DESTINATION.icon}
          data-density="compact"
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
              data-density="compact"
            />
          </li>
        )}
      </For>
    </Grid>
  );
};
