// Place persistence: venues, restaurants, and shops with optional coordinates.
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  placeInputSchema,
  type PlaceInput,
  type PlacePatch,
} from "~/lib/events/schemas";
import {
  formatAddress,
  normalizePlaceName,
  type Place,
  type PlaceKind,
  type PlaceSummary,
} from "~/lib/events/types";

export const PLACE_SUMMARY_SELECT = {
  id: true,
  name: true,
  kind: true,
  street: true,
  city: true,
  state: true,
  postalCode: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.PlaceSelect;

type PlaceSummaryRecord = Prisma.PlaceGetPayload<{
  select: typeof PLACE_SUMMARY_SELECT;
}>;
type PlaceRecord = Prisma.PlaceGetPayload<object>;

export const mapPlaceSummary = (p: PlaceSummaryRecord): PlaceSummary => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  address: formatAddress(p),
  latitude: p.latitude,
  longitude: p.longitude,
});

export const mapPlace = (p: PlaceRecord): Place => ({
  ...mapPlaceSummary(p),
  street: p.street,
  city: p.city,
  state: p.state,
  postalCode: p.postalCode,
  url: p.url,
  notes: p.notes,
  docId: p.docId,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const clean = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).map(([k, v]) => [
      k,
      typeof v === "string" ? v.trim() || null : v,
    ]),
  ) as T;

export async function listPlaces(
  input: { kind?: PlaceKind; search?: string } = {},
): Promise<Place[]> {
  const rows = await prisma.place.findMany({
    where: {
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { city: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 1000,
  });
  return rows.map(mapPlace);
}

export async function getPlace(id: string): Promise<Place | null> {
  const row = await prisma.place.findUnique({ where: { id } });
  return row ? mapPlace(row) : null;
}

/** Places whose normalized name matches, for dedupe before creating one. */
export async function findPlacesByName(name: string): Promise<Place[]> {
  const rows = await prisma.place.findMany({
    where: { normalizedName: normalizePlaceName(name) },
    take: 10,
  });
  return rows.map(mapPlace);
}

export async function createPlace(input: PlaceInput): Promise<Place> {
  const parsed = clean(placeInputSchema.parse(input));
  const row = await prisma.place.create({
    data: { ...parsed, normalizedName: normalizePlaceName(parsed.name) },
  });
  return mapPlace(row);
}

/** Returns the place with the same name (and city, when given) or creates it. */
export async function findOrCreatePlace(
  input: PlaceInput,
): Promise<{ place: Place; created: boolean }> {
  const matches = await findPlacesByName(input.name);
  const city = input.city?.trim().toLowerCase();
  const match = matches.find(
    (p) => !city || !p.city || p.city.toLowerCase() === city,
  );
  if (match) return { place: match, created: false };
  return { place: await createPlace(input), created: true };
}

export async function updatePlace(
  id: string,
  patch: PlacePatch,
): Promise<Place> {
  const data = clean(patch) as Prisma.PlaceUncheckedUpdateInput;
  if (patch.name) data.normalizedName = normalizePlaceName(patch.name);
  const row = await prisma.place.update({ where: { id }, data });
  return mapPlace(row);
}

/** Deletes a place; events and shows that used it fall back to no place. */
export async function deletePlace(id: string) {
  await prisma.place.delete({ where: { id } });
}
