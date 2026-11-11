import {
  CalendarDaysIcon,
  KanbanIcon,
  LayoutGridIcon,
  TableIcon,
} from "lucide-solid";
import type { ViewType } from "~/lib/collections/types";

export const VIEW_ICONS: Record<ViewType, typeof TableIcon> = {
  table: TableIcon,
  board: KanbanIcon,
  gallery: LayoutGridIcon,
  calendar: CalendarDaysIcon,
};
export const VIEW_LABELS: Record<ViewType, string> = {
  table: "Table",
  board: "Board",
  gallery: "Gallery",
  calendar: "Calendar",
};
