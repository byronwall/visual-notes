import { action, json } from "@solidjs/router";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { contentColumns, prepareContent } from "~/server/notes/note-store";
import { rebuildNoteIndex } from "~/server/notes/note-index";
import {
  OPTION_COLORS,
  PROPERTY_KINDS,
  STATUS_GROUPS,
  VIEW_TYPES,
  type CollectionProperty,
  type CollectionRow,
  type CollectionView,
  type PropertyConfig,
  type PropertyKind,
  type PropertyValue,
  type SelectOption,
  type ViewConfig,
} from "~/lib/collections/types";
import { coerceValue } from "~/lib/collections/values";
import { fetchRecentItems } from "~/services/recents/recents.queries";
import { rankBetween } from "~/lib/collections/rank";
import {
  ROW_SELECT,
  applyRowPatch,
  applyRowsPatch,
  asObject,
  defaultConfigFor,
  mapProperty,
  mapRow,
  mapView,
  newOptionId,
  requireCollection,
  validatePatch,
} from "./collections.server";
import { fetchCollections } from "./collections.queries";
import {
  createCollectionRecord,
  createPropertyRecord,
  createViewRecord,
} from "~/server/collections/collection-store";

// Collection edits are applied optimistically by the client store, so most
// actions revalidate nothing; a bare action would refetch every query.
const NO_REVALIDATE = { revalidate: [] as string[] };
const quiet = <T>(data: T) => json(data, NO_REVALIDATE);

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1).max(120);

const optionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  color: z.enum(OPTION_COLORS),
  group: z.enum(STATUS_GROUPS).optional(),
});

const configSchema = z
  .object({
    format: z.string().max(32).optional(),
    options: z.array(optionSchema).max(500).optional(),
    decimals: z.number().int().min(0).max(8).optional(),
    currency: z.string().max(8).optional(),
    ratingMax: z.number().int().min(1).max(10).optional(),
    includeTime: z.boolean().optional(),
  })
  .strict();

// ---------- Collections ----------

export const createCollection = action(
  async (payload: { name: string; description?: string; icon?: string }) => {
    "use server";
    const input = z
      .object({
        name,
        description: z.string().max(2000).optional(),
        icon: z.string().max(16).optional(),
      })
      .parse(payload);
    const created = await createCollectionRecord(input);
    return json(
      { id: created.id },
      { revalidate: [fetchCollections.key, fetchRecentItems.key] },
    );
  },
  "collections-create",
);

export const updateCollection = action(
  async (payload: {
    id: string;
    name?: string;
    description?: string | null;
    icon?: string | null;
  }) => {
    "use server";
    const input = z
      .object({
        id,
        name: name.optional(),
        description: z.string().max(2000).nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
      })
      .parse(payload);
    await requireCollection(input.id);
    const { id: collectionId, ...data } = input;
    await prisma.collection.update({ where: { id: collectionId }, data });
    return json(
      { ok: true },
      { revalidate: [fetchCollections.key, fetchRecentItems.key] },
    );
  },
  "collections-update",
);

/** Soft-deletes a collection. Its rows become plain notes; content is untouched. */
export const deleteCollection = action(async (collectionId: string) => {
  "use server";
  await requireCollection(id.parse(collectionId));
  await prisma.$transaction([
    prisma.doc.updateMany({
      where: { collectionId },
      data: { collectionId: null },
    }),
    prisma.collection.update({
      where: { id: collectionId },
      data: { deletedAt: new Date() },
    }),
  ]);
  console.info("[collections] deleted %s", collectionId);
  return json(
    { ok: true },
    { revalidate: [fetchCollections.key, fetchRecentItems.key] },
  );
}, "collections-delete");

// ---------- Properties ----------

export const createProperty = action(
  async (payload: {
    collectionId: string;
    name: string;
    kind: PropertyKind;
    config?: PropertyConfig;
  }) => {
    "use server";
    const input = z
      .object({
        collectionId: id,
        name,
        kind: z.enum(PROPERTY_KINDS),
        config: configSchema.optional(),
      })
      .parse(payload);
    return quiet(
      await createPropertyRecord({
        ...input,
        config: input.config as PropertyConfig | undefined,
      }),
    );
  },
  "collections-property-create",
);

export const updateProperty = action(
  async (payload: { id: string; name?: string; config?: PropertyConfig }) => {
    "use server";
    const input = z
      .object({ id, name: name.optional(), config: configSchema.optional() })
      .parse(payload);
    const existing = await prisma.collectionProperty.findFirst({
      where: { id: input.id, deletedAt: null },
    });
    if (!existing) throw new Error("Property not found");
    const updated = await prisma.collectionProperty.update({
      where: { id: input.id },
      data: {
        name: input.name,
        config: input.config
          ? (input.config as Prisma.InputJsonValue)
          : undefined,
      },
    });
    return quiet(mapProperty(updated));
  },
  "collections-property-update",
);

/** Hides a property everywhere. Stored values stay until a later cleanup. */
export const deleteProperty = action(async (propertyId: string) => {
  "use server";
  await prisma.collectionProperty.update({
    where: { id: id.parse(propertyId) },
    data: { deletedAt: new Date() },
  });
  return quiet({ ok: true });
}, "collections-property-delete");

export const reorderProperties = action(
  async (payload: { collectionId: string; propertyIds: string[] }) => {
    "use server";
    const input = z
      .object({ collectionId: id, propertyIds: z.array(id).max(200) })
      .parse(payload);
    await prisma.$transaction(
      input.propertyIds.map((propertyId, position) =>
        prisma.collectionProperty.updateMany({
          where: { id: propertyId, collectionId: input.collectionId },
          data: { position },
        }),
      ),
    );
    return quiet({ ok: true });
  },
  "collections-property-reorder",
);

/** Adds an option to a select-like property and returns it. */
export const createSelectOption = action(
  async (payload: {
    propertyId: string;
    name: string;
    color?: SelectOption["color"];
    group?: SelectOption["group"];
  }) => {
    "use server";
    const input = z
      .object({
        propertyId: id,
        name,
        color: z.enum(OPTION_COLORS).optional(),
        group: z.enum(STATUS_GROUPS).optional(),
      })
      .parse(payload);
    return prisma.$transaction(async (tx) => {
      const prop = await tx.collectionProperty.findFirst({
        where: { id: input.propertyId, deletedAt: null },
      });
      if (!prop) throw new Error("Property not found");
      if (!["select", "status", "multi_select"].includes(prop.kind))
        throw new Error("Not a select property");
      const config = asObject<PropertyConfig>(prop.config);
      const options = config.options ?? [];
      const existing = options.find(
        (o) => o.name.toLowerCase() === input.name.toLowerCase(),
      );
      if (existing)
        return quiet({ option: existing, property: mapProperty(prop) });
      const option: SelectOption = {
        id: newOptionId(),
        name: input.name,
        color:
          input.color ??
          OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length]!,
        ...(prop.kind === "status" ? { group: input.group ?? "todo" } : {}),
      };
      const updated = await tx.collectionProperty.update({
        where: { id: prop.id },
        data: {
          config: {
            ...config,
            options: [...options, option],
          } as Prisma.InputJsonValue,
        },
      });
      return quiet({ option, property: mapProperty(updated) });
    });
  },
  "collections-option-create",
);

// ---------- Rows ----------

const patchInput = z.object({
  collectionId: id,
  docIds: z.array(id).min(1).max(5000),
  patch: z.record(z.unknown()),
});

/** Sets property values on one or more rows (bulk edit uses the same path). */
export const setRowProperties = action(
  async (payload: {
    collectionId: string;
    docIds: string[];
    patch: Record<string, PropertyValue>;
  }) => {
    "use server";
    const input = patchInput.parse(payload);
    if (input.docIds.length === 1) {
      const [docId] = input.docIds as [string];
      const { updatedAt } = await applyRowPatch(
        input.collectionId,
        docId,
        input.patch,
      );
      return quiet({ updatedAt: { [docId]: updatedAt } });
    }
    const updatedAt = await applyRowsPatch(
      input.collectionId,
      input.docIds,
      input.patch,
    );
    return quiet({ updatedAt });
  },
  "collections-row-set",
);

export const setRowTitle = action(
  async (payload: { docId: string; title: string }) => {
    "use server";
    const input = z
      .object({ docId: id, title: z.string().trim().max(200) })
      .parse(payload);
    const updated = await prisma.doc.update({
      where: { id: input.docId },
      data: { title: input.title || "Untitled" },
      select: { updatedAt: true, title: true },
    });
    return quiet({
      title: updated.title,
      updatedAt: updated.updatedAt.toISOString(),
    });
  },
  "collections-row-title",
);

export const createRow = action(
  async (payload: {
    collectionId: string;
    title?: string;
    properties?: Record<string, PropertyValue>;
    afterRank?: string | null;
    beforeRank?: string | null;
  }): Promise<CollectionRow> => {
    "use server";
    const input = z
      .object({
        collectionId: id,
        title: z.string().max(200).optional(),
        properties: z.record(z.unknown()).optional(),
        afterRank: z.string().max(200).nullable().optional(),
        beforeRank: z.string().max(200).nullable().optional(),
      })
      .parse(payload);
    await requireCollection(input.collectionId);
    const { set } = await validatePatch(
      input.collectionId,
      input.properties ?? {},
    );
    let rank: string;
    if (input.afterRank !== undefined || input.beforeRank !== undefined) {
      rank = rankBetween(input.afterRank ?? null, input.beforeRank ?? null);
    } else {
      const last = await prisma.doc.findFirst({
        where: {
          collectionId: input.collectionId,
          collectionRank: { not: null },
        },
        orderBy: { collectionRank: "desc" },
        select: { collectionRank: true },
      });
      rank = rankBetween(last?.collectionRank ?? null, null);
    }
    // A row is a note: create its (empty) block body through the note store
    // and build its block index in the same transaction.
    const content = prepareContent({ markdown: "" });
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.doc.create({
        data: {
          title: input.title?.trim() || "Untitled",
          ...contentColumns(content),
          contentVersion: 1,
          collectionId: input.collectionId,
          properties: set as Prisma.InputJsonValue,
          collectionRank: rank,
        },
        select: ROW_SELECT,
      });
      await rebuildNoteIndex(tx, row.id, content);
      return row;
    });
    await logActionEvent({
      eventType: "doc.create",
      entityType: "doc",
      entityId: created.id,
      relatedDocId: created.id,
      payload: { source: "collection", collectionId: input.collectionId },
    });
    return quiet(mapRow(created)) as unknown as CollectionRow;
  },
  "collections-row-create",
);

export const moveRow = action(
  async (payload: {
    collectionId: string;
    docId: string;
    afterRank: string | null;
    beforeRank: string | null;
  }) => {
    "use server";
    const input = z
      .object({
        collectionId: id,
        docId: id,
        afterRank: z.string().nullable(),
        beforeRank: z.string().nullable(),
      })
      .parse(payload);
    const rank = rankBetween(input.afterRank, input.beforeRank);
    await prisma.doc.updateMany({
      where: { id: input.docId, collectionId: input.collectionId },
      data: { collectionRank: rank },
    });
    return quiet({ rank });
  },
  "collections-row-move",
);

/** Deletes row notes entirely (the notes are gone, like deleting a note). */
export const deleteRows = action(
  async (payload: { collectionId: string; docIds: string[] }) => {
    "use server";
    const input = z
      .object({ collectionId: id, docIds: z.array(id).min(1).max(5000) })
      .parse(payload);
    const result = await prisma.doc.deleteMany({
      where: { id: { in: input.docIds }, collectionId: input.collectionId },
    });
    for (const docId of input.docIds) {
      await logActionEvent({
        eventType: "doc.delete",
        entityType: "doc",
        entityId: docId,
        relatedDocId: docId,
      });
    }
    return quiet({ deleted: result.count });
  },
  "collections-rows-delete",
);

/** Takes notes out of a collection. Values stay stored on the note. */
export const removeRowsFromCollection = action(
  async (payload: { collectionId: string; docIds: string[] }) => {
    "use server";
    const input = z
      .object({ collectionId: id, docIds: z.array(id).min(1).max(5000) })
      .parse(payload);
    const result = await prisma.doc.updateMany({
      where: { id: { in: input.docIds }, collectionId: input.collectionId },
      data: { collectionId: null },
    });
    return json(
      { removed: result.count },
      { revalidate: [fetchCollections.key] },
    );
  },
  "collections-rows-remove",
);

// ---------- Views ----------

const viewConfigSchema = z.record(z.unknown());

export const createView = action(
  async (payload: {
    collectionId: string;
    name: string;
    type: CollectionView["type"];
    config?: ViewConfig;
    hostDocId?: string | null;
  }): Promise<CollectionView> => {
    "use server";
    const input = z
      .object({
        collectionId: id,
        name,
        type: z.enum(VIEW_TYPES),
        config: viewConfigSchema.optional(),
        hostDocId: id.nullable().optional(),
      })
      .parse(payload);
    const created = await createViewRecord(input);
    return quiet(created) as unknown as CollectionView;
  },
  "collections-view-create",
);

export const updateView = action(
  async (payload: {
    id: string;
    name?: string;
    type?: CollectionView["type"];
    config?: ViewConfig;
  }) => {
    "use server";
    const input = z
      .object({
        id,
        name: name.optional(),
        type: z.enum(VIEW_TYPES).optional(),
        config: viewConfigSchema.optional(),
      })
      .parse(payload);
    const updated = await prisma.collectionView.update({
      where: { id: input.id },
      data: {
        name: input.name,
        type: input.type,
        config: input.config
          ? (input.config as Prisma.InputJsonValue)
          : undefined,
      },
    });
    return quiet(mapView(updated));
  },
  "collections-view-update",
);

export const deleteView = action(async (viewId: string) => {
  "use server";
  const view = await prisma.collectionView.findUnique({
    where: { id: id.parse(viewId) },
  });
  if (!view) return quiet({ ok: true });
  if (!view.hostDocId) {
    const remaining = await prisma.collectionView.count({
      where: { collectionId: view.collectionId, hostDocId: null },
    });
    if (remaining <= 1) throw new Error("A collection needs at least one view");
  }
  await prisma.collectionView.delete({ where: { id: view.id } });
  return quiet({ ok: true });
}, "collections-view-delete");

export const reorderViews = action(
  async (payload: { collectionId: string; viewIds: string[] }) => {
    "use server";
    const input = z
      .object({ collectionId: id, viewIds: z.array(id).max(100) })
      .parse(payload);
    await prisma.$transaction(
      input.viewIds.map((viewId, position) =>
        prisma.collectionView.updateMany({
          where: { id: viewId, collectionId: input.collectionId },
          data: { position },
        }),
      ),
    );
    return quiet({ ok: true });
  },
  "collections-view-reorder",
);

export type { CollectionProperty } from "~/lib/collections/types";

// ---------- Type change ----------

const SELECT_LIKE: PropertyKind[] = ["select", "status", "multi_select"];

/** Computes the target config and converted values for a kind change. */
async function planKindChange(propertyId: string, kind: PropertyKind) {
  const prop = await prisma.collectionProperty.findFirst({
    where: { id: propertyId, deletedAt: null },
  });
  if (!prop) throw new Error("Property not found");
  const from = mapProperty(prop);
  let config: PropertyConfig = defaultConfigFor(kind);
  if (SELECT_LIKE.includes(from.kind) && SELECT_LIKE.includes(kind)) {
    config = {
      options: (from.config.options ?? []).map((o) => ({
        ...o,
        ...(kind === "status"
          ? { group: o.group ?? "todo" }
          : { group: undefined }),
      })),
    };
  }
  if (from.kind === "number" && kind === "number") config = from.config;
  const rows = await prisma.doc.findMany({
    where: { collectionId: prop.collectionId },
    select: { id: true, properties: true },
  });
  const options = [...(config.options ?? [])];
  const target = (): CollectionProperty => ({
    ...from,
    kind,
    config: { ...config, options },
  });
  let lost = 0;
  let converted = 0;
  const updates: Array<{ id: string; value: PropertyValue }> = [];
  // Two passes: first collect any options the values need, then convert.
  if (SELECT_LIKE.includes(kind) && !SELECT_LIKE.includes(from.kind)) {
    for (const row of rows) {
      const value = asObject<Record<string, PropertyValue>>(row.properties)[
        from.id
      ];
      if (value === undefined || value === null) continue;
      const { newOptions } = coerceValue(from, target(), value);
      for (const optionName of newOptions) {
        if (
          !options.some(
            (o) => o.name.toLowerCase() === optionName.toLowerCase(),
          )
        ) {
          options.push({
            id: newOptionId(),
            name: optionName,
            color: OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length]!,
            ...(kind === "status" ? { group: "todo" as const } : {}),
          });
        }
      }
    }
  }
  for (const row of rows) {
    const value = asObject<Record<string, PropertyValue>>(row.properties)[
      from.id
    ];
    if (value === undefined || value === null) continue;
    converted++;
    const result = coerceValue(from, target(), value);
    if (result.lost) lost++;
    updates.push({ id: row.id, value: result.value });
  }
  return {
    from,
    target: target(),
    collectionId: prop.collectionId,
    updates,
    converted,
    lost,
  };
}

export const changePropertyKind = action(
  async (payload: {
    propertyId: string;
    kind: PropertyKind;
    apply: boolean;
  }) => {
    "use server";
    const input = z
      .object({
        propertyId: id,
        kind: z.enum(PROPERTY_KINDS),
        apply: z.boolean(),
      })
      .parse(payload);
    const plan = await planKindChange(input.propertyId, input.kind);
    if (!input.apply)
      return quiet({
        converted: plan.converted,
        lost: plan.lost,
        applied: false as const,
      });
    const key = plan.from.id;
    await prisma.$transaction([
      prisma.collectionProperty.update({
        where: { id: key },
        data: {
          kind: input.kind,
          config: plan.target.config as Prisma.InputJsonValue,
        },
      }),
      ...plan.updates.map((u) =>
        u.value === null
          ? prisma.$executeRaw`UPDATE "Doc" SET "properties" = "properties" - ${key} WHERE "id" = ${u.id}`
          : prisma.$executeRaw`UPDATE "Doc" SET "properties" = jsonb_set(COALESCE("properties", '{}'::jsonb), ARRAY[${key}]::text[], ${JSON.stringify(u.value)}::jsonb) WHERE "id" = ${u.id}`,
      ),
    ]);
    console.info(
      "[collections] kind %s %s→%s rows:%d lost:%d",
      key,
      plan.from.kind,
      input.kind,
      plan.converted,
      plan.lost,
    );
    return quiet({
      converted: plan.converted,
      lost: plan.lost,
      applied: true as const,
      property: plan.target,
      values: Object.fromEntries(plan.updates.map((u) => [u.id, u.value])),
    });
  },
  "collections-property-kind",
);
