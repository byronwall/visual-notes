import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import { publishAppChange } from "~/server/note-events";
import { applyView } from "~/lib/collections/query";
import {
  FILTER_OPERATORS,
  PROPERTY_KINDS,
  VIEW_TYPES,
  type CollectionProperty,
  type ViewConfig,
} from "~/lib/collections/types";
import {
  createCollectionRecord,
  createPropertyRecord,
  addNotes,
  createViewRecord,
  ensureOptions,
} from "~/server/collections/collection-store";
import {
  ROW_SELECT,
  applyRowPatch,
  attachNotes,
  localToday,
  mapRow,
  mapView,
} from "~/services/collections/collections.server";
import {
  buildFilter,
  buildSorts,
  describeProperty,
  loadLiveProperties,
  planValues,
  propertyByName,
  resolveCollection,
  rowView,
} from "./collections-agent";
import { ConnectorError, isChatGptNote, type ConnectorContext } from "./notes-shared";
import { createNote } from "./notes-write";

// Collections over the connector. Rows are notes, so a new row is a note the
// agent owns; property values are metadata, so agents may set them on any
// row. Deleting collections, rows, properties, and views stays with the user,
// as do column widths, row order, and other layout.

export const COLLECTION_TOOL_SCOPES: Record<string, string> = {
  collections_list: "notes:read",
  collections_get: "notes:read",
  collections_query: "notes:read",
  collections_create: "notes:write",
  collections_update: "notes:write",
  collections_add_property: "notes:write",
  collections_update_property: "notes:write",
  collections_add_row: "notes:write",
  collections_set_properties: "notes:write",
  collections_add_notes: "notes:write",
  collections_remove_notes: "notes:write",
  collections_create_view: "notes:write",
};

export const COLLECTION_INSTRUCTIONS =
  "Collections are typed tables whose rows are notes. Read the schema with collections_get, find rows with collections_query (filters and sorts by property name; option values by name), add rows with collections_add_row, and set values with collections_set_properties using plain text (\"In progress\", \"2026-11-01\", [\"a\", \"b\"]). To show a table in a note you wrote, create a view hosted by that note (collections_create_view with hostNoteId) and put its `{{collection-view:id}}` line in the note.";

type Guarded = (ctx: ConnectorContext, tool: string, fn: () => Promise<unknown>) => Promise<CallToolResult>;

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const collectionArg = z.string().min(1).describe("Collection id or exact name");
const valuesArg = z
  .record(z.string(), z.unknown())
  .describe('Values by property name: text, numbers, true/false, "YYYY-MM-DD" dates, option names (a list for multi-select); null clears');
const filterArg = z
  .array(
    z.object({
      property: z.string().describe('Property name, or "Title"'),
      op: z.enum(FILTER_OPERATORS),
      value: z.unknown().optional().describe("Option name(s) for select ops; a number of days for past_days/next_days"),
    }),
  )
  .describe("All must match");
const sortArg = z.array(z.object({ property: z.string(), direction: z.enum(["asc", "desc"]).optional() }));
const propertySpec = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(PROPERTY_KINDS),
  options: z.array(z.string().trim().min(1).max(120)).max(100).optional().describe("For select, status, multi_select"),
});

export function registerCollectionTools(server: McpServer, ctx: ConnectorContext, guarded: Guarded): void {
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
  const log = (eventType: string, collection: { id: string; name: string }, payload: Record<string, string | number | string[]> = {}) =>
    logActionEvent({
      eventType,
      entityType: "collection",
      entityId: collection.id,
      payload: { collectionName: collection.name, ...payload },
      context,
    });
  const changed = (collectionId: string) => publishAppChange("collections", [collectionId]);

  /** Applies a by-name patch, creating any missing options first. */
  const setValues = async (collectionId: string, docIds: string[], values: Record<string, unknown>) => {
    let properties = await loadLiveProperties(collectionId);
    const first = planValues(properties, values);
    if (Object.keys(first.newOptions).length) {
      properties = await prisma.$transaction((tx) => ensureOptions(tx, properties, first.newOptions));
    }
    const { patch } = Object.keys(first.newOptions).length ? planValues(properties, values) : first;
    for (const docId of docIds) await applyRowPatch(collectionId, docId, patch);
    return { properties, patch };
  };

  const addOptionNames = async (property: CollectionProperty, names: string[]) => {
    if (!names.length) return property;
    if (!["select", "status", "multi_select"].includes(property.kind)) {
      throw new ConnectorError("invalid", `"${property.name}" is a ${property.kind} property and has no options.`);
    }
    const [updated] = await prisma.$transaction((tx) => ensureOptions(tx, [property], { [property.id]: names }));
    return updated;
  };

  server.registerTool(
    "collections_list",
    {
      title: "List collections",
      description: "Collections with row counts and their property names.",
      annotations: readOnly,
    },
    () =>
      guarded(ctx, "collections_list", async () => {
        const collections = await prisma.collection.findMany({
          where: { deletedAt: null },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { rows: true } },
            properties: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { name: true } },
          },
        });
        return collections.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          rowCount: c._count.rows,
          properties: c.properties.map((p) => p.name),
          url: `${ctx.origin}/collections/${c.id}`,
        }));
      }),
  );

  server.registerTool(
    "collections_get",
    {
      title: "Get collection schema",
      description: "A collection's properties (kinds, options, read-only flags) and views.",
      inputSchema: { collection: collectionArg },
      annotations: readOnly,
    },
    ({ collection }) =>
      guarded(ctx, "collections_get", async () => {
        const found = await resolveCollection(collection);
        const [properties, views, rowCount] = await Promise.all([
          loadLiveProperties(found.id),
          prisma.collectionView.findMany({ where: { collectionId: found.id }, orderBy: { position: "asc" } }),
          prisma.doc.count({ where: { collectionId: found.id } }),
        ]);
        return {
          id: found.id,
          name: found.name,
          description: found.description,
          rowCount,
          properties: properties.map(describeProperty),
          views: views.map(mapView).map((v) => ({ id: v.id, name: v.name, type: v.type, hostNoteId: v.hostDocId })),
          url: `${ctx.origin}/collections/${found.id}`,
        };
      }),
  );

  server.registerTool(
    "collections_query",
    {
      title: "Query collection rows",
      description:
        "Rows of a collection, filtered and sorted. Start from a saved view's filters and sorts with view, add where/sort/search on top. Values come back as text by property name.",
      inputSchema: {
        collection: collectionArg,
        view: z.string().optional().describe("View id or name to start from"),
        where: filterArg.optional(),
        sort: sortArg.optional(),
        search: z.string().optional().describe("Matches the title or any value"),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: readOnly,
    },
    (args) =>
      guarded(ctx, "collections_query", async () => {
        const found = await resolveCollection(args.collection);
        const properties = await loadLiveProperties(found.id);
        let viewConfig: ViewConfig = {};
        if (args.view) {
          const views = (await prisma.collectionView.findMany({ where: { collectionId: found.id } })).map(mapView);
          const view = views.find((v) => v.id === args.view || v.name.toLowerCase() === args.view!.toLowerCase());
          if (!view) throw new ConnectorError("not_found", `No view "${args.view}". Views: ${views.map((v) => v.name).join(", ")}.`);
          viewConfig = view.config;
        }
        const rows = (
          await prisma.doc.findMany({
            where: { collectionId: found.id },
            select: ROW_SELECT,
            orderBy: [{ collectionRank: "asc" }, { createdAt: "asc" }],
          })
        ).map(mapRow);
        // The view's filter first, then the agent's on top; the agent's sort
        // replaces the view's.
        const today = localToday();
        const inView = applyView(rows, properties, { filter: viewConfig.filter, search: viewConfig.search }, today);
        const matched = applyView(
          inView,
          properties,
          {
            filter: args.where?.length ? buildFilter(properties, args.where) : undefined,
            search: args.search,
            sorts: args.sort?.length ? buildSorts(properties, args.sort) : viewConfig.sorts,
          },
          today,
        );
        const limit = args.limit ?? 50;
        return {
          collection: found.name,
          total: matched.length,
          rows: matched.slice(0, limit).map((row) => rowView(ctx.origin, row, properties)),
          truncated: matched.length > limit,
        };
      }),
  );

  server.registerTool(
    "collections_create",
    {
      title: "Create collection",
      description: "A new collection. It starts with Status and Tags properties and a Table view; add more properties here.",
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        description: z.string().max(2000).optional(),
        properties: z.array(propertySpec).max(50).optional(),
      },
      annotations: write,
    },
    ({ name, description, properties }) =>
      guarded(ctx, "collections_create", async () => {
        const created = await createCollectionRecord({ name, description });
        const existing = new Set(["status", "tags"]);
        for (const spec of properties ?? []) {
          if (existing.has(spec.name.toLowerCase())) continue;
          existing.add(spec.name.toLowerCase());
          const property = await createPropertyRecord({ collectionId: created.id, name: spec.name, kind: spec.kind });
          await addOptionNames(property, spec.options ?? []);
        }
        await log("collection.created", created, { propertyCount: (properties?.length ?? 0) + 2 });
        changed(created.id);
        return { id: created.id, name: created.name, url: `${ctx.origin}/collections/${created.id}` };
      }),
  );

  server.registerTool(
    "collections_update",
    {
      title: "Rename collection",
      description: "Change a collection's name or description.",
      inputSchema: {
        collection: collectionArg,
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
      },
      annotations: write,
    },
    ({ collection, name, description }) =>
      guarded(ctx, "collections_update", async () => {
        const found = await resolveCollection(collection);
        const updated = await prisma.collection.update({
          where: { id: found.id },
          data: { ...(name ? { name } : {}), ...(description !== undefined ? { description } : {}) },
        });
        await log("collection.updated", updated, { previousName: found.name });
        changed(found.id);
        return { id: updated.id, name: updated.name, description: updated.description };
      }),
  );

  server.registerTool(
    "collections_add_property",
    {
      title: "Add collection property",
      inputSchema: { collection: collectionArg, ...propertySpec.shape },
      annotations: write,
    },
    ({ collection, name, kind, options }) =>
      guarded(ctx, "collections_add_property", async () => {
        const found = await resolveCollection(collection);
        const properties = await loadLiveProperties(found.id);
        if (properties.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          throw new ConnectorError("invalid", `"${found.name}" already has a property named "${name}".`);
        }
        const property = await addOptionNames(await createPropertyRecord({ collectionId: found.id, name, kind }), options ?? []);
        await log("collection.property_added", found, { property: name, kind });
        changed(found.id);
        return describeProperty(property);
      }),
  );

  server.registerTool(
    "collections_update_property",
    {
      title: "Update collection property",
      description: "Rename a property and/or add options to a select, status, or multi-select property.",
      inputSchema: {
        collection: collectionArg,
        property: z.string().min(1),
        rename: z.string().trim().min(1).max(120).optional(),
        addOptions: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
      },
      annotations: write,
    },
    ({ collection, property, rename, addOptions }) =>
      guarded(ctx, "collections_update_property", async () => {
        const found = await resolveCollection(collection);
        let target = propertyByName(await loadLiveProperties(found.id), property);
        target = await addOptionNames(target, addOptions ?? []);
        if (rename) {
          await prisma.collectionProperty.update({ where: { id: target.id }, data: { name: rename } });
          target = { ...target, name: rename };
        }
        await log("collection.property_updated", found, { property: target.name });
        changed(found.id);
        return describeProperty(target);
      }),
  );

  server.registerTool(
    "collections_add_row",
    {
      title: "Add collection row",
      description:
        "Add a row: a new note you own (so you can edit its body later), placed in the collection with these values. Missing option names are created.",
      inputSchema: {
        collection: collectionArg,
        title: z.string().min(1).max(200),
        markdown: z.string().optional().describe("Note body; the get_notes markdown dialect"),
        path: z.string().max(512).optional(),
        values: valuesArg.optional(),
        idempotencyKey: z.string().max(200).optional(),
      },
      annotations: write,
    },
    ({ collection, title, markdown, path, values, idempotencyKey }) =>
      guarded(ctx, "collections_add_row", async () => {
        const found = await resolveCollection(collection);
        // Check the values before anything is written.
        planValues(await loadLiveProperties(found.id), values ?? {});
        const note = await createNote(ctx, { title, markdown: markdown ?? "", path, idempotencyKey }, { allowEmptyBody: true });
        // A retry after a failure between create and attach finishes the job.
        const placed = await prisma.doc.findUnique({ where: { id: note.id }, select: { collectionId: true } });
        if (!note.deduplicated || placed?.collectionId !== found.id) {
          await attachNotes(found.id, [note.id]);
          if (values && Object.keys(values).length) await setValues(found.id, [note.id], values);
          await log("collection.row_added", found, { rowTitle: title });
          changed(found.id);
        }
        const [row] = await prisma.doc.findMany({ where: { id: note.id }, select: ROW_SELECT });
        return rowView(ctx.origin, mapRow(row), await loadLiveProperties(found.id));
      }),
  );

  server.registerTool(
    "collections_set_properties",
    {
      title: "Set collection values",
      description: "Set property values on up to 200 rows. Each row gets its own values. Missing option names are created.",
      inputSchema: {
        collection: collectionArg,
        rows: z.array(z.object({ id: z.string().min(1), values: valuesArg })).min(1).max(200),
      },
      annotations: { ...write, idempotentHint: true },
    },
    ({ collection, rows }) =>
      guarded(ctx, "collections_set_properties", async () => {
        const found = await resolveCollection(collection);
        const members = await prisma.doc.findMany({
          where: { id: { in: rows.map((r) => r.id) }, collectionId: found.id },
          select: { id: true },
        });
        const inCollection = new Set(members.map((m) => m.id));
        const missing = rows.filter((r) => !inCollection.has(r.id)).map((r) => r.id);
        if (missing.length) {
          throw new ConnectorError("invalid", `Not rows of "${found.name}": ${missing.join(", ")}. Add them with collections_add_notes first.`);
        }
        // Validate everything first so a bad value writes nothing.
        const properties = await loadLiveProperties(found.id);
        for (const row of rows) planValues(properties, row.values);
        for (const row of rows) await setValues(found.id, [row.id], row.values);
        await log("collection.rows_updated", found, { rowCount: rows.length });
        changed(found.id);
        const updated = await prisma.doc.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: ROW_SELECT });
        const fresh = await loadLiveProperties(found.id);
        return updated.map((row) => rowView(ctx.origin, mapRow(row), fresh));
      }),
  );

  server.registerTool(
    "collections_add_notes",
    {
      title: "Add notes to collection",
      description:
        "Make existing notes rows of a collection. Values stored for it before come back; meta keys matching property names fill the rest. A note in another collection moves, carrying values that match by name.",
      inputSchema: { collection: collectionArg, noteIds: z.array(z.string().min(1)).min(1).max(500) },
      annotations: write,
    },
    ({ collection, noteIds }) =>
      guarded(ctx, "collections_add_notes", async () => {
        const found = await resolveCollection(collection);
        const existing = await prisma.doc.findMany({ where: { id: { in: noteIds } }, select: { id: true } });
        const missing = noteIds.filter((id) => !existing.some((d) => d.id === id));
        if (missing.length) throw new ConnectorError("not_found", `No notes: ${missing.join(", ")}.`);
        const result = await addNotes(found.id, noteIds);
        await log("collection.notes_added", found, { rowCount: noteIds.length });
        changed(found.id);
        return result.rows.map((row) => rowView(ctx.origin, row, result.properties));
      }),
  );

  server.registerTool(
    "collections_remove_notes",
    {
      title: "Remove notes from collection",
      description: "Take notes out of a collection. The notes stay, and their values are kept in case they come back.",
      inputSchema: { collection: collectionArg, noteIds: z.array(z.string().min(1)).min(1).max(500) },
      annotations: write,
    },
    ({ collection, noteIds }) =>
      guarded(ctx, "collections_remove_notes", async () => {
        const found = await resolveCollection(collection);
        const result = await prisma.doc.updateMany({
          where: { id: { in: noteIds }, collectionId: found.id },
          data: { collectionId: null },
        });
        await log("collection.notes_removed", found, { rowCount: result.count });
        changed(found.id);
        return { removed: result.count };
      }),
  );

  server.registerTool(
    "collections_create_view",
    {
      title: "Create collection view",
      description:
        "A saved table, board, gallery, or calendar view with filters and sorts. With hostNoteId (a note you created) it becomes that note's embed: add the returned embed line to the note with edit_note or append_to_note.",
      inputSchema: {
        collection: collectionArg,
        name: z.string().trim().min(1).max(120),
        type: z.enum(VIEW_TYPES).optional(),
        where: filterArg.optional(),
        sort: sortArg.optional(),
        groupBy: z.string().optional().describe("Board: select or status property name"),
        dateProperty: z.string().optional().describe("Calendar: date property name"),
        hiddenProperties: z.array(z.string()).optional(),
        hostNoteId: z.string().optional(),
      },
      annotations: write,
    },
    (args) =>
      guarded(ctx, "collections_create_view", async () => {
        const found = await resolveCollection(args.collection);
        const properties = await loadLiveProperties(found.id);
        const type = args.type ?? "table";
        if (args.hostNoteId) {
          const host = await prisma.doc.findUnique({ where: { id: args.hostNoteId }, select: { originalSource: true } });
          if (!host) throw new ConnectorError("not_found", `No note "${args.hostNoteId}".`);
          if (!isChatGptNote(host)) {
            throw new ConnectorError("not_owner", "You can only embed views in notes you created.");
          }
        }
        const config: ViewConfig = {
          ...(args.where?.length ? { filter: buildFilter(properties, args.where) } : {}),
          ...(args.sort?.length ? { sorts: buildSorts(properties, args.sort) } : {}),
          ...(args.hiddenProperties?.length
            ? { hiddenProperties: args.hiddenProperties.map((name) => propertyByName(properties, name).id) }
            : {}),
        };
        if (type === "board") {
          const group = args.groupBy
            ? propertyByName(properties, args.groupBy)
            : properties.find((p) => p.kind === "status" || p.kind === "select");
          if (!group || !["status", "select"].includes(group.kind)) {
            throw new ConnectorError("invalid", "A board needs a select or status property to group by (groupBy).");
          }
          config.groupBy = group.id;
        }
        if (type === "calendar") {
          const date = args.dateProperty ? propertyByName(properties, args.dateProperty) : properties.find((p) => p.kind === "date");
          if (!date || date.kind !== "date") {
            throw new ConnectorError("invalid", "A calendar needs a date property (dateProperty).");
          }
          config.dateProperty = date.id;
        }
        const view = await createViewRecord({
          collectionId: found.id,
          name: args.name,
          type,
          config,
          hostDocId: args.hostNoteId ?? null,
        });
        await log("collection.view_created", found, { view: view.name, type });
        changed(found.id);
        return {
          id: view.id,
          name: view.name,
          type: view.type,
          hostNoteId: view.hostDocId,
          embed: view.hostDocId ? `{{collection-view:${view.id}}}` : null,
          url: `${ctx.origin}/collections/${found.id}`,
        };
      }),
  );
}
