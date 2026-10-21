// Shapes returned by the /events view queries.
import type { EventsFilters } from "./filters";
import type { OccurrenceListItem, Place } from "./types";

export type ShowsViewInput = EventsFilters & {
  /**
   * Calendar mode: the six-week grid around `month` (`YYYY-MM`, else the
   * current month) instead of today forward.
   */
  calendar?: boolean;
  month?: string;
  /** Cache-busting nonce for refetches after a write; the server ignores it. */
  refresh?: number;
};

export type ShowsView = {
  today: string;
  /** The month shown, in calendar mode. */
  month: string;
  items: OccurrenceListItem[];
};

export type PlaceWithCounts = Place & { upcomingCount: number };
