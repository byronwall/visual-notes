import {
  ActivityIcon,
  ArchiveIcon,
  CalendarClockIcon,
  CalendarHeartIcon,
  CompassIcon,
  DatabaseIcon,
  HashIcon,
  FileTextIcon,
  LayoutGridIcon,
  ListTodoIcon,
  MapIcon,
  NetworkIcon,
  ShieldIcon,
  SparklesIcon,
  TelescopeIcon,
  WaypointsIcon,
} from "lucide-solid";
import type { JSX } from "solid-js";

export type SidebarNavIcon = (props: {
  size?: number;
  strokeWidth?: number;
}) => JSX.Element;

export type AppDestination = {
  label: string;
  href: string;
  icon: SidebarNavIcon;
  /** Extra words that should match this destination in the command palette. */
  keywords?: string;
  isActive: (pathname: string) => boolean;
};

export const isSectionActive = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const isNotesActive = (pathname: string) =>
  pathname === "/" || isSectionActive("/docs", pathname);

export const NOTES_DESTINATION: AppDestination = {
  label: "Notes",
  href: "/",
  icon: FileTextIcon,
  keywords: "docs home index",
  isActive: isNotesActive,
};

export const CANVAS_DESTINATION: AppDestination = {
  label: "Canvas",
  href: "/canvas",
  icon: LayoutGridIcon,
  keywords: "visual board",
  isActive: (pathname) => isSectionActive("/canvas", pathname),
};

export const CANVAS_CHILD_DESTINATIONS: AppDestination[] = [
  {
    label: "Embeddings",
    href: "/embeddings",
    icon: NetworkIcon,
    keywords: "vectors",
    isActive: (pathname) => isSectionActive("/embeddings", pathname),
  },
  {
    label: "UMAP",
    href: "/umap",
    icon: MapIcon,
    keywords: "clusters map",
    isActive: (pathname) => isSectionActive("/umap", pathname),
  },
];

export const isCanvasSectionActive = (pathname: string) =>
  CANVAS_DESTINATION.isActive(pathname) ||
  CANVAS_CHILD_DESTINATIONS.some((item) => item.isActive(pathname));

/**
 * Primary sections after Notes + Canvas, in sidebar grid order (row-major,
 * two columns): Collections | Paths, Tasks | Time Blocks, Research | Tags.
 */
export const PRIMARY_DESTINATIONS: AppDestination[] = [
  {
    label: "Collections",
    href: "/collections",
    icon: DatabaseIcon,
    keywords: "database table board gallery",
    isActive: (pathname) => isSectionActive("/collections", pathname),
  },
  {
    label: "Paths",
    href: "/path",
    icon: WaypointsIcon,
    keywords: "folders tree",
    isActive: (pathname) =>
      isSectionActive("/path", pathname) || pathname === "/paths",
  },
  {
    label: "Events",
    href: "/events",
    icon: CalendarHeartIcon,
    keywords: "date nights shows places map ical feeds subscribe",
    isActive: (pathname) => isSectionActive("/events", pathname),
  },
  {
    label: "Tasks",
    href: "/tasks",
    icon: ListTodoIcon,
    keywords: "todo open tasks in notes",
    isActive: (pathname) =>
      isSectionActive("/tasks", pathname) || pathname === "/views/note-tasks",
  },
  {
    label: "Time Blocks",
    href: "/time-blocks",
    icon: CalendarClockIcon,
    keywords: "calendar schedule week",
    isActive: (pathname) => isSectionActive("/time-blocks", pathname),
  },
  {
    label: "Research",
    href: "/research",
    icon: TelescopeIcon,
    keywords: "topics threads frontier findings",
    isActive: (pathname) => isSectionActive("/research", pathname),
  },
  {
    label: "Tags",
    href: "/tags",
    icon: HashIcon,
    keywords: "labels topics hashtags",
    isActive: (pathname) => isSectionActive("/tags", pathname),
  },
  {
    label: "Explorer",
    href: "/archive",
    icon: CompassIcon,
    keywords: "archive bookmarks",
    isActive: (pathname) => isSectionActive("/archive", pathname),
  },
];

/** Utility destinations shown as footer icons in the sidebar. */
export const UTILITY_DESTINATIONS: AppDestination[] = [
  {
    label: "AI Dashboard",
    href: "/ai",
    icon: SparklesIcon,
    keywords: "prompts runs llm",
    isActive: (pathname) => isSectionActive("/ai", pathname),
  },
  {
    label: "Activity",
    href: "/activity",
    icon: ActivityIcon,
    keywords: "history log",
    isActive: (pathname) => isSectionActive("/activity", pathname),
  },
  {
    label: "Archived notes",
    href: "/docs/archived",
    icon: ArchiveIcon,
    keywords: "cleanup trash restore deleted",
    isActive: (pathname) => isSectionActive("/docs/archived", pathname),
  },
  {
    label: "Admin",
    href: "/admin",
    icon: ShieldIcon,
    keywords: "settings migrations",
    isActive: (pathname) => isSectionActive("/admin", pathname),
  },
];

/** Every navigable destination, in command-palette order. */
export const ALL_DESTINATIONS: AppDestination[] = [
  NOTES_DESTINATION,
  CANVAS_DESTINATION,
  ...CANVAS_CHILD_DESTINATIONS,
  ...PRIMARY_DESTINATIONS,
  ...UTILITY_DESTINATIONS,
];

/** Section name for the default document title of a route. */
export const sectionTitleForPath = (pathname: string): string | undefined => {
  if (pathname === "/login") return "Sign in";
  const match = [...ALL_DESTINATIONS]
    .reverse()
    .find((item) => item.isActive(pathname));
  return match?.label;
};
