import { OPTION_PALETTE } from "~/lib/collections/colors";
import type { OptionColor } from "~/lib/collections/types";
import { DECISION_COLORS } from "~/lib/events/filters";
import {
  formatLocalDate,
  formatShowWhen,
  showLocalDate,
} from "~/lib/events/format";
import { groupShowsByPlace, hasCoords } from "~/lib/events/grouping";
import {
  DECISION_LABELS,
  PLACE_KIND_LABELS,
  type OccurrenceListItem,
  type PlaceKind,
} from "~/lib/events/types";
import type { PlaceWithCounts } from "~/lib/events/view-types";

/** `when` is a short date for the side list; `meta` the full popup line. */
export type MapLink = {
  href: string;
  text: string;
  when: string;
  meta: string;
};

/** One marker and its side-list row, in either map mode. */
export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Marker fill, from the shared option palette. */
  ink: string;
  address: string;
  meta: string;
  links: MapLink[];
};

export const KIND_COLORS: Record<PlaceKind, OptionColor> = {
  venue: "purple",
  restaurant: "orange",
  shop: "green",
  other: "gray",
};

const ink = (c: OptionColor) => OPTION_PALETTE[c].ink;

export function eventPoints(items: OccurrenceListItem[]) {
  const live = items.filter((s) => s.status !== "cancelled");
  const { points, unmapped } = groupShowsByPlace(live);
  return {
    unmapped,
    points: points.map(
      ({ place, shows }): MapPoint => ({
        id: place.id,
        name: place.name,
        lat: place.latitude,
        lng: place.longitude,
        ink: ink(DECISION_COLORS[shows[0]!.effectiveDecision]),
        address: place.address,
        meta: `${shows.length} upcoming · next ${formatLocalDate(showLocalDate(shows[0]!))}`,
        links: shows.map((s) => ({
          href: `/docs/${s.docId}`,
          text: s.title || "Untitled",
          when: formatLocalDate(showLocalDate(s)),
          meta: `${formatShowWhen(s)} · ${DECISION_LABELS[s.effectiveDecision]}`,
        })),
      }),
    ),
  };
}

export function placePoints(places: PlaceWithCounts[]) {
  const mapped = places.filter(hasCoords);
  return {
    unmapped: places.length - mapped.length,
    points: mapped.map(
      (p): MapPoint => ({
        id: p.id,
        name: p.name,
        lat: p.latitude,
        lng: p.longitude,
        ink: ink(KIND_COLORS[p.kind]),
        address: p.address,
        meta: [
          PLACE_KIND_LABELS[p.kind],
          p.upcomingCount ? `${p.upcomingCount} upcoming` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        links: p.docId
          ? [{ href: `/docs/${p.docId}`, text: "Write-up", when: "", meta: "" }]
          : [],
      }),
    ),
  };
}
