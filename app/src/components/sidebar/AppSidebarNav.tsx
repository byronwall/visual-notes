import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  LayoutGridIcon,
  MapIcon,
  NetworkIcon,
  ShieldIcon,
  SparklesIcon,
} from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Box, Stack, VisuallyHidden } from "styled-system/jsx";

type NavItem = {
  label: string;
  href: string;
  icon: (props: { size?: number; strokeWidth?: number }) => JSX.Element;
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
      label: "Canvas",
      href: "/canvas",
      icon: LayoutGridIcon,
      isActive: (path) => isActiveSection("/canvas", path),
    },
    {
      label: "Embeddings",
      href: "/embeddings",
      icon: NetworkIcon,
      isActive: (path) => isActiveSection("/embeddings", path),
    },
    {
      label: "UMAP",
      href: "/umap",
      icon: MapIcon,
      isActive: (path) => isActiveSection("/umap", path),
    },
    {
      label: "AI",
      href: "/ai",
      icon: SparklesIcon,
      isActive: (path) => isActiveSection("/ai", path),
    },
    {
      label: "Admin",
      href: "/admin/migrations",
      icon: ShieldIcon,
      isActive: (path) => isActiveSection("/admin", path),
    },
  ];

  const navButtonStyle = (active: boolean) => ({
    bg: active ? "bg.muted" : "transparent",
    color: active ? "fg.default" : "fg.muted",
    borderRadius: "l2",
    _hover: {
      bg: "bg.muted",
      color: "fg.default",
    },
  });

  return (
    <Stack gap="1">
      <For each={navItems}>
        {(item) => (
          <Button
            variant="plain"
            size="sm"
            aria-current={item.isActive(pathname()) ? "page" : undefined}
            onClick={() => navigate(item.href)}
            px={props.expanded ? "3" : "2"}
            py="2"
            w="full"
            display="flex"
            alignItems="center"
            justifyContent={props.expanded ? "flex-start" : "center"}
            gap={props.expanded ? "2" : "0"}
            {...navButtonStyle(item.isActive(pathname()))}
            title={item.label}
          >
            <item.icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <Show when={props.expanded}>
              <Box as="span">{item.label}</Box>
            </Show>
            <Show when={!props.expanded}>
              <VisuallyHidden>{item.label}</VisuallyHidden>
            </Show>
          </Button>
        )}
      </For>
    </Stack>
  );
};
