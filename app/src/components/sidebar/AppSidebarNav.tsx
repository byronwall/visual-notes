import type { JSX } from "solid-js";
import { For } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { WaypointsIcon } from "lucide-solid";
import { Stack } from "styled-system/jsx";
import { AppSidebarCanvasMenu } from "./AppSidebarCanvasMenu";
import { SidebarNavButton, type SidebarNavIcon } from "./SidebarNavButton";

type NavItem = {
  label: string;
  href: string;
  icon: SidebarNavIcon;
  isActive: (pathname: string) => boolean;
};

type AppSidebarNavProps = {
  expanded: boolean;
};

export const AppSidebarNav = (props: AppSidebarNavProps) => {
  const location = useLocation();
  const pathname = () => location.pathname;
  const navigate = useNavigate();

  const isActiveSection = (href: string, path: string) =>
    path === href || path.startsWith(`${href}/`);

  const navItems: NavItem[] = [
    {
      label: "Paths",
      href: "/path",
      icon: WaypointsIcon,
      isActive: (path) => isActiveSection("/path", path),
    },
  ];

  return (
    <Stack gap="1">
      <AppSidebarCanvasMenu
        expanded={props.expanded}
        pathname={pathname()}
        onNavigate={navigate}
      />

      <For each={navItems}>
        {(item) => (
          <SidebarNavButton
            expanded={props.expanded}
            active={item.isActive(pathname())}
            label={item.label}
            icon={item.icon}
            onClick={() => navigate(item.href)}
          />
        )}
      </For>
    </Stack>
  );
};
