import { query } from "@solidjs/router";
import type { PlaceKind } from "~/lib/events/types";
import type { ShowsViewInput } from "~/lib/events/view-types";
import {
  listPlacesWithCounts,
  listShowsView,
} from "~/server/calendar/event-views";

// Keys extend `events-occurrences` / `events-places` on purpose: Solid
// revalidates by key prefix, so every events action that refreshes those
// reads refreshes these views too.

export const fetchShowsView = query(async (input: ShowsViewInput) => {
  "use server";
  return listShowsView(input);
}, "events-occurrences-view");

export const fetchPlacesWithCounts = query(
  async (input: { kind?: PlaceKind; search?: string; refresh?: number }) => {
    "use server";
    return listPlacesWithCounts(input ?? {});
  },
  "events-places-view",
);
