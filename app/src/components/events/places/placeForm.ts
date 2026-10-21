import type { PlaceInput } from "~/lib/events/schemas";
import type { Place, PlaceKind } from "~/lib/events/types";

/** Text values for the place dialog; numbers stay strings while typing. */
export type PlaceFormValues = {
  name: string;
  kind: PlaceKind;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  url: string;
  notes: string;
};

export const emptyPlaceForm = (): PlaceFormValues => ({
  name: "",
  kind: "venue",
  street: "",
  city: "Indianapolis",
  state: "IN",
  postalCode: "",
  latitude: "",
  longitude: "",
  url: "",
  notes: "",
});

export const placeFormFrom = (p: Place): PlaceFormValues => ({
  name: p.name,
  kind: p.kind,
  street: p.street ?? "",
  city: p.city ?? "",
  state: p.state ?? "",
  postalCode: p.postalCode ?? "",
  latitude: p.latitude == null ? "" : String(p.latitude),
  longitude: p.longitude == null ? "" : String(p.longitude),
  url: p.url ?? "",
  notes: p.notes ?? "",
});

const text = (v: string) => v.trim() || null;

const coord = (v: string, max: number) => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined;
};

/** Validated action input, or a message for the first problem found. */
export function toPlaceInput(
  v: PlaceFormValues,
): { input: PlaceInput } | { error: string } {
  if (!v.name.trim()) return { error: "Name is required." };
  const latitude = coord(v.latitude, 90);
  const longitude = coord(v.longitude, 180);
  if (latitude === undefined)
    return { error: "Latitude must be a number from -90 to 90." };
  if (longitude === undefined)
    return { error: "Longitude must be a number from -180 to 180." };
  if ((latitude == null) !== (longitude == null))
    return { error: "Enter both latitude and longitude, or neither." };
  return {
    input: {
      name: v.name.trim(),
      kind: v.kind,
      street: text(v.street),
      city: text(v.city),
      state: text(v.state),
      postalCode: text(v.postalCode),
      latitude,
      longitude,
      url: text(v.url),
      notes: text(v.notes),
    },
  };
}
