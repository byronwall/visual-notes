import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import {
  LayoutGridIcon,
  MapIcon,
  NetworkIcon,
  SparklesIcon,
} from "lucide-solid";
import { Link } from "~/components/ui/link";
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
  ];

  const navLinkStyle = (active: boolean) => ({
    bg: active ? "bg.muted" : "transparent",
    color: active ? "fg.default" : "fg.muted",
    borderRadius: "l2",
    textDecorationLine: "none",
    _hover: {
      bg: "bg.muted",
      color: "fg.default",
      textDecorationLine: "none",
    },
  });

  return (
    <Stack gap="1">
      <For each={navItems}>
        {(item) => (
          <Link
            href={item.href}
            variant="plain"
            aria-current={item.isActive(pathname()) ? "page" : undefined}
            px={props.expanded ? "3" : "2"}
            py="2"
            display="flex"
            alignItems="center"
            justifyContent={props.expanded ? "flex-start" : "center"}
            gap={props.expanded ? "2" : "0"}
            {...navLinkStyle(item.isActive(pathname()))}
            title={item.label}
          >
            <item.icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <Show when={props.expanded}>
              <Box as="span">{item.label}</Box>
            </Show>
            <Show when={!props.expanded}>
              <VisuallyHidden>{item.label}</VisuallyHidden>
            </Show>
          </Link>
        )}
      </For>
    </Stack>
  );
};
