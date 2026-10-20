// Server-only helpers shared by collection queries and actions.
import type {
  Collection as DbCollection,
  CollectionProperty as DbProperty,
  CollectionView as DbView,
  Prisma,
} from "@prisma/client";
import { getRequestEvent } from "solid-js/web";
import { prisma } from "~/server/db";
import { ranksAfter } from "~/lib/collections/rank";
import { validateValue } from "~/lib/collections/values";
import type {
  PropertyKind,
  PropertyValue,
  SelectOption,
  CollectionProperty,
  CollectionRow,
  CollectionSummary,
  CollectionView,
  PropertyConfig,
  RowProperties,
  ViewConfig,
} from "~/lib/collections/types";

export const ROW_SELECT = {
  id: true,
  title: true,
  properties: true,
  collectionRank: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocSelect;

type RowRecord = Prisma.DocGetPayload<{ select: typeof ROW_SELECT }>;

export const asObject = <T extends object>(value: unknown): T =>
  (value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}) as T;

export const mapCollection = (c: DbCollection): CollectionSummary => ({
  id: c.id,
  name: c.name,
  description: c.description,
  icon: c.icon,
});

export const mapProperty = (p: DbProperty): CollectionProperty => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  config: asObject<PropertyConfig>(p.config),
  position: p.position,
});

export const mapView = (v: DbView): CollectionView => ({
  id: v.id,
  collectionId: v.collectionId,
  hostDocId: v.hostDocId,
  name: v.name,
  type: v.type,
  config: asObject<ViewConfig>(v.config),
  position: v.position,
});

export const mapRow = (r: RowRecord): CollectionRow => ({
  id: r.id,
  title: r.title,
  properties: asObject<RowProperties>(r.properties),
  rank: r.collectionRank,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/**
 * Today's date in the viewer's time zone (from the `vn_tz` cookie the client
 * sets), so relative date filters agree between SSR and the browser.
 */
export const localToday = () => {
  const cookie = getRequestEvent()?.request.headers.get("cookie") ?? "";
  const tz = decodeURIComponent(
    /(?:^|;\s*)vn_tz=([^;]+)/.exec(cookie)?.[1] ?? "",
  );
  try {
    if (tz)
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
        new Date(),
      );
  } catch {
    // Unknown zone: fall back to the server clock.
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export async function loadLiveProperties(collectionId: string) {
  const rows = await prisma.collectionProperty.findMany({
    where: { collectionId, deletedAt: null },
    orderBy: { position: "asc" },
  });
  return rows.map(mapProperty);
}

export async function requireCollection(id: string) {
  const collection = await prisma.collection.findFirst({
    where: { id, deletedAt: null },
  });
  if (!collection) throw new Error("Collection not found");
  return collection;
}

export const newOptionId = () =>
  `opt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;

export const defaultStatusOptions = (): SelectOption[] => [
  { id: newOptionId(), name: "Not started", color: "gray", group: "todo" },
  { id: newOptionId(), name: "In progress", color: "blue", group: "doing" },
  { id: newOptionId(), name: "Done", color: "green", group: "done" },
];

export const defaultConfigFor = (kind: PropertyKind): PropertyConfig => {
  switch (kind) {
    case "status":
      return { options: defaultStatusOptions() };
    case "select":
    case "multi_select":
      return { options: [] };
    case "number":
      return { format: "plain" };
    case "text":
      return { format: "plain" };
    default:
      return {};
  }
};

export async function validatePatch(
  collectionId: string,
  patch: Record<string, unknown>,
) {
  const properties = await loadLiveProperties(collectionId);
  const byId = new Map(properties.map((p) => [p.id, p]));
  const set: Record<string, PropertyValue> = {};
  const clear: string[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    const property = byId.get(key);
    if (!property) throw new Error(`Unknown property ${key}`);
    const result = validateValue(property, raw);
    if (!result.ok) throw new Error(result.error);
    if (result.value === null) clear.push(key);
    else set[key] = result.value;
  }
  return { set, clear };
}

/**
 * Merges a patch into one row's values in a single statement, so concurrent
 * edits to different properties never overwrite each other.
 */
export async function applyRowPatch(
  collectionId: string,
  docId: string,
  patch: Record<string, unknown>,
): Promise<{ updatedAt: string }> {
  const { set, clear } = await validatePatch(collectionId, patch);
  const rows = await prisma.$queryRaw<Array<{ updatedAt: Date }>>`
    UPDATE "Doc"
    SET "properties" = (COALESCE("properties", '{}'::jsonb) || ${JSON.stringify(set)}::jsonb) - ${clear}::text[],
        "updatedAt" = now()
    WHERE "id" = ${docId} AND "collectionId" = ${collectionId}
    RETURNING "updatedAt"`;
  if (!rows[0]) throw new Error("Row not found in this collection");
  return { updatedAt: rows[0].updatedAt.toISOString() };
}

/** The same merge as `applyRowPatch` across many rows in one statement. */
export async function applyRowsPatch(
  collectionId: string,
  docIds: string[],
  patch: Record<string, unknown>,
): Promise<Record<string, string>> {
  const { set, clear } = await validatePatch(collectionId, patch);
  const rows = await prisma.$queryRaw<Array<{ id: string; updatedAt: Date }>>`
    UPDATE "Doc"
    SET "properties" = (COALESCE("properties", '{}'::jsonb) || ${JSON.stringify(set)}::jsonb) - ${clear}::text[],
        "updatedAt" = now()
    WHERE "id" = ANY(${docIds}::text[]) AND "collectionId" = ${collectionId}
    RETURNING "id", "updatedAt"`;
  return Object.fromEntries(rows.map((r) => [r.id, r.updatedAt.toISOString()]));
}

/** Adds existing notes to a collection, appending them in the given order. */
export async function attachNotes(collectionId: string, docIds: string[]) {
  const last = await prisma.doc.findFirst({
    where: { collectionId, collectionRank: { not: null } },
    orderBy: { collectionRank: "desc" },
    select: { collectionRank: true },
  });
  const ranks = ranksAfter(last?.collectionRank ?? null, docIds.length);
  await prisma.$transaction(
    docIds.map((docId, i) =>
      prisma.doc.update({
        where: { id: docId },
        data: { collectionId, collectionRank: ranks[i] },
      }),
    ),
  );
}
