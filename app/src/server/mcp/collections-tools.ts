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
  attachNotes,
  localToday,
  mapRow,
  mapView,
} from "~/services/collections/collections.server";
import {
  buildFilter,
  buildSorts,
  checkRowValues,
  collectionAppUrl,
  describeProperty,
  loadLiveProperties,
  propertyByName,
  resolveCollection,
  rowView,
  setRowValues,
} from "./collections-agent";
import { agentContext, ConnectorError, limitArg, requireNotes } from "./shared";
import type { ToolRegistrar } from "./tool-registry";
import { withEventColumns } from "~/server/calendar/event-columns";
import { createNote } from "./notes-write";

// Collections over the connector. Rows are notes, so a new row is a note the
// agent owns; property values are metadata, so agents may set them on any
// row. Deleting collections, rows, properties, and views stays with the user,
// as do column widths, row order, and other layout.

export const COLLECTION_INSTRUCTIONS =
  'Collections are typed tables whose rows are notes. A row that happens on a date is an event: create it with events_create (collection, values, shows), never collections_add_row. collections_get shows the schema, collections_query finds rows, and collections_add_row / collections_add_rows / collections_set_values write values as plain text by property and option name ("In progress", "2026-11-01", ["a", "b"]). To show a table in a note, call collections_create_view with hostNoteId and put the returned embed line in the note. Each row body is about that row; shared context goes in one note the rows link to.';

const collectionArg = z.string().min(1).describe("Collection id or exact name");
const valuesArg = z
  .record(z.string(), z.unknown())
  .describe(
    'Values by property name: text, numbers, true/false, "YYYY-MM-DD" dates, option names (a list for multi-select); null clears',
  );
const filterArg = z
  .array(
    z.object({
      property: z.string().describe('Property name, or "Title"'),
      op: z.enum(FILTER_OPERATORS),
      value: z
        .unknown()
        .optional()
        .describe(
          "Option name(s) for select ops; a number of days for past_days/next_days",
        ),
    }),
  )
  .describe("All must match");
const MAX_NEW_ROWS = 50;
const newRowArg = z.object({
  title: z.string().min(1).max(200),
  markdown: z
    .string()
    .optional()
    .describe("Note body about this row only; the notes_get markdown dialect"),
  path: z.string().max(512).optional(),
  values: valuesArg.optional(),
  idempotencyKey: z.string().max(200).optional(),
});

/** How many rows of the collection have an event. */
const countEventRows = (collectionId: string) =>
  prisma.event.count({ where: { doc: { collectionId } } });

/** Warns when plain rows land in a collection of events. */
export function plainRowNotice(eventRows: number, noteIds: string[]) {
  if (!eventRows || !noteIds.length) return null;
  const one = noteIds.length === 1;
  return `${eventRows} rows in this collection are events, but the new ${one ? "row is a plain note" : "rows are plain notes"} with no shows. If ${one ? "it happens" : "they happen"} on a date, call events_add_shows (and events_update for the url, place, and decision) with noteId ${noteIds.join(", ")}, then check with events_get.`;
}

/** Rows whose bodies open with the same text, as when shared context is pasted into each. */
const OPENING_CHARS = 160;
export function sharedOpeningNotice(
  rows: { title: string; markdown?: string }[],
): string | null {
  const byOpening = new Map<string, string[]>();
  for (const row of rows) {
    // The first paragraph, which is also what the row's snippet shows.
    const opening = (row.markdown ?? "")
      .trim()
      .split(/\n\s*\n/)[0]!
      .slice(0, OPENING_CHARS);
    if (opening.length < 40) continue;
    byOpening.set(opening, [...(byOpening.get(opening) ?? []), row.title]);
  }
  const repeated = [...byOpening.values()].filter(
    (titles) => titles.length > 1,
  );
  if (!repeated.length) return null;
  const titles = repeated.flat();
  return `${titles.length} rows open with the same text (${titles.map((t) => `"${t}"`).join(", ")}), so their snippets all point at the same thing. Rewrite each body to start with that row's own status, evidence, and next step (notes_update), and keep the shared context in one note the rows link to.`;
}

const sortArg = z.array(
  z.object({
    property: z.string(),
    direction: z.enum(["asc", "desc"]).optional(),
  }),
);
const propertySpec = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(PROPERTY_KINDS),
  options: z
    .array(z.string().trim().min(1).max(120))
    .max(100)
    .optional()
    .describe("For select, status, multi_select"),
});

export function registerCollectionTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const log = (
    eventType: string,
    collection: { id: string; name: string },
    payload: Record<string, string | number | string[]> = {},
  ) =>
    logActionEvent({
      eventType,
      entityType: "collection",
      entityId: collection.id,
      payload: { collectionName: collection.name, ...payload },
      context: agentContext(ctx),
    });
  const changed = (collectionId: string) =>
    publishAppChange("collections", [collectionId]);

  /**
   * One new row: a note the agent owns, placed with its values. Says whether
   * anything changed, so a batch announces the collection once.
   */
  const placeRow = async (
    found: { id: string; name: string },
    input: z.infer<typeof newRowArg>,
    schema: { properties: CollectionProperty[] },
  ) => {
    const { title, markdown, path, values, idempotencyKey } = input;
    const note = await createNote(
      ctx,
      { title, markdown: markdown ?? "", path, idempotencyKey },
      { allowEmptyBody: true },
    );
    // A retry after a failure between create and attach finishes the job.
    const placed = await prisma.doc.findUnique({
      where: { id: note.id },
      select: { collectionId: true },
    });
    if (!note.deduplicated || placed?.collectionId !== found.id) {
      await attachNotes(found.id, [note.id]);
      if (values && Object.keys(values).length)
        schema.properties = await setRowValues(
          found.id,
          [note.id],
          values,
          schema.properties,
        );
      await log("collection.row_added", found, { rowTitle: title });
      return { noteId: note.id, placed: true };
    }
    return { noteId: note.id, placed: false };
  };

  /** Row views for these notes, read in one query. */
  const rowViews = async (
    noteIds: string[],
    properties: CollectionProperty[],
  ) => {
    const rows = await prisma.doc.findMany({
      where: { id: { in: noteIds } },
      select: ROW_SELECT,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return noteIds.map((id) => rowView(ctx, mapRow(byId.get(id)!), properties));
  };

  const addOptionNames = async (
    property: CollectionProperty,
    names: string[],
  ) => {
    if (!names.length) return property;
    if (!["select", "status", "multi_select"].includes(property.kind)) {
      throw new ConnectorError(
        "invalid",
        `"${property.name}" is a ${property.kind} property and has no options.`,
      );
    }
    const [updated] = await prisma.$transaction((tx) =>
      ensureOptions(tx, [property], { [property.id]: names }),
    );
    return updated;
  };

  tools.read(
    "collections_list",
    {
      title: "List collections",
      description: "Collections with row counts and their property names.",
    },
    async () => {
      const collections = await prisma.collection.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { rows: true } },
          properties: {
            where: { deletedAt: null },
            orderBy: { position: "asc" },
            select: { name: true },
          },
        },
      });
      return {
        collections: collections.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          rowCount: c._count.rows,
          properties: c.properties.map((p) => p.name),
          appUrl: collectionAppUrl(ctx, c.id),
        })),
      };
    },
  );

  tools.read(
    "collections_get",
    {
      title: "Get collection schema",
      description:
        "A collection's properties (kinds, options, read-only flags) and views.",
      input: { collection: collectionArg },
    },
    async ({ collection }) => {
      const found = await resolveCollection(collection);
      const [properties, views, rowCount, eventRows] = await Promise.all([
        loadLiveProperties(found.id),
        prisma.collectionView.findMany({
          where: { collectionId: found.id },
          orderBy: { position: "asc" },
        }),
        prisma.doc.count({ where: { collectionId: found.id } }),
        countEventRows(found.id),
      ]);
      return {
        id: found.id,
        name: found.name,
        description: found.description,
        showRowsInRecent: found.showRowsInRecent,
        rowCount,
        ...(eventRows
          ? {
              eventRows,
              eventNote: `${eventRows} of ${rowCount} rows are events. Add a new one with events_create (collection, values, shows), not collections_add_row. collections_query shows each row's event; event: null is a plain note.`,
            }
          : {}),
        properties: properties.map(describeProperty),
        views: views.map(mapView).map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          hostNoteId: v.hostDocId,
        })),
        appUrl: collectionAppUrl(ctx, found.id),
      };
    },
  );

  tools.read(
    "collections_query",
    {
      title: "Query collection rows",
      description:
        "Rows of a collection, filtered and sorted. Start from a saved view's filters and sorts with view, add where/sort/search on top. Values come back as text by property name.",
      input: {
        collection: collectionArg,
        view: z.string().optional().describe("View id or name to start from"),
        where: filterArg.optional(),
        sort: sortArg.optional(),
        search: z
          .string()
          .optional()
          .describe("Matches the title or any value"),
        limit: limitArg(500, 50),
      },
    },
    async (args) => {
      const found = await resolveCollection(args.collection);
      const properties = await loadLiveProperties(found.id);
      let viewConfig: ViewConfig = {};
      if (args.view) {
        const views = (
          await prisma.collectionView.findMany({
            where: { collectionId: found.id },
          })
        ).map(mapView);
        const view = views.find(
          (v) =>
            v.id === args.view ||
            v.name.toLowerCase() === args.view!.toLowerCase(),
        );
        if (!view)
          throw new ConnectorError(
            "not_found",
            `No view "${args.view}". Views: ${views.map((v) => v.name).join(", ")}.`,
          );
        viewConfig = view.config;
      }
      const rows = (
        await prisma.doc.findMany({
          where: { collectionId: found.id },
          select: ROW_SELECT,
          orderBy: [{ collectionRank: "asc" }, { createdAt: "asc" }],
        })
      ).map(mapRow);
      // Event columns join the schema here, so agents can filter and sort
      // by "Next show" or "Decision" and see which rows are events.
      const columns = [
        ...properties,
        ...(await withEventColumns(rows, properties)),
      ];
      // The view's filter first, then the agent's on top; the agent's sort
      // replaces the view's.
      const today = localToday();
      const inView = applyView(
        rows,
        columns,
        { filter: viewConfig.filter, search: viewConfig.search },
        today,
      );
      const matched = applyView(
        inView,
        columns,
        {
          filter: args.where?.length
            ? buildFilter(columns, args.where)
            : undefined,
          search: args.search,
          sorts: args.sort?.length
            ? buildSorts(columns, args.sort)
            : viewConfig.sorts,
        },
        today,
      );
      const limit = args.limit ?? 50;
      return {
        collection: found.name,
        total: matched.length,
        rows: matched.slice(0, limit).map((row) => rowView(ctx, row, columns)),
        truncated: matched.length > limit,
      };
    },
  );

  tools.write(
    "collections_create",
    {
      title: "Create collection",
      description:
        "A new collection. It starts with Status and Tags properties and a Table view; add more properties here.",
      input: {
        name: z.string().trim().min(1).max(120),
        description: z.string().max(2000).optional(),
        properties: z.array(propertySpec).max(50).optional(),
      },
    },
    async ({ name, description, properties }) => {
      const created = await createCollectionRecord({ name, description });
      const existing = new Set(["status", "tags"]);
      for (const spec of properties ?? []) {
        if (existing.has(spec.name.toLowerCase())) continue;
        existing.add(spec.name.toLowerCase());
        const property = await createPropertyRecord({
          collectionId: created.id,
          name: spec.name,
          kind: spec.kind,
        });
        await addOptionNames(property, spec.options ?? []);
      }
      await log("collection.created", created, {
        propertyCount: (properties?.length ?? 0) + 2,
      });
      changed(created.id);
      return {
        id: created.id,
        name: created.name,
        appUrl: collectionAppUrl(ctx, created.id),
      };
    },
  );

  tools.write(
    "collections_update",
    {
      title: "Update collection",
      description:
        "Change a collection's name, description, or whether its rows always show in the sidebar Recent list and on the notes index.",
      input: {
        collection: collectionArg,
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
        showRowsInRecent: z.boolean().optional(),
      },
    },
    async ({ collection, name, description, showRowsInRecent }) => {
      const found = await resolveCollection(collection);
      const updated = await prisma.collection.update({
        where: { id: found.id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(showRowsInRecent !== undefined ? { showRowsInRecent } : {}),
        },
      });
      await log("collection.updated", updated, { previousName: found.name });
      changed(found.id);
      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        showRowsInRecent: updated.showRowsInRecent,
        appUrl: collectionAppUrl(ctx, updated.id),
      };
    },
  );

  tools.write(
    "collections_add_property",
    {
      title: "Add collection property",
      description:
        "Add a property (column) to a collection, with options for select, status, or multi-select kinds.",
      input: { collection: collectionArg, ...propertySpec.shape },
    },
    async ({ collection, name, kind, options }) => {
      const found = await resolveCollection(collection);
      const properties = await loadLiveProperties(found.id);
      if (properties.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new ConnectorError(
          "invalid",
          `"${found.name}" already has a property named "${name}".`,
        );
      }
      const property = await addOptionNames(
        await createPropertyRecord({ collectionId: found.id, name, kind }),
        options ?? [],
      );
      await log("collection.property_added", found, { property: name, kind });
      changed(found.id);
      return describeProperty(property);
    },
  );

  tools.write(
    "collections_update_property",
    {
      title: "Update collection property",
      description:
        "Rename a property and/or add options to a select, status, or multi-select property.",
      input: {
        collection: collectionArg,
        property: z.string().min(1),
        rename: z.string().trim().min(1).max(120).optional(),
        addOptions: z
          .array(z.string().trim().min(1).max(120))
          .max(100)
          .optional(),
      },
    },
    async ({ collection, property, rename, addOptions }) => {
      const found = await resolveCollection(collection);
      let target = propertyByName(await loadLiveProperties(found.id), property);
      target = await addOptionNames(target, addOptions ?? []);
      if (rename) {
        await prisma.collectionProperty.update({
          where: { id: target.id },
          data: { name: rename },
        });
        target = { ...target, name: rename };
      }
      await log("collection.property_updated", found, {
        property: target.name,
      });
      changed(found.id);
      return describeProperty(target);
    },
  );

  tools.write(
    "collections_add_row",
    {
      title: "Add collection row",
      description:
        "Add a row: a new note you own (so you can edit its body later), placed in the collection with these values. Missing option names are created. The row is a plain note: for anything that happens on a date (meetup, show, class, appointment), use events_create with collection and values instead. A date in the body or in a value does not make it an event.",
      input: { collection: collectionArg, ...newRowArg.shape },
    },
    async ({ collection, ...row }) => {
      const found = await resolveCollection(collection);
      // Check the values before anything is written.
      await checkRowValues(found.id, [row.values ?? {}]);
      const schema = { properties: await loadLiveProperties(found.id) };
      const { noteId, placed } = await placeRow(found, row, schema);
      if (placed) changed(found.id);
      const [view] = await rowViews([noteId], schema.properties);
      const notice = plainRowNotice(await countEventRows(found.id), [noteId]);
      return { ...view!, ...(notice ? { notice } : {}) };
    },
  );

  tools.write(
    "collections_add_rows",
    {
      title: "Add collection rows",
      description: `Add up to ${MAX_NEW_ROWS} rows in one call, each a new note you own with its own title, body, and values. Rows are plain notes: for dated items, call events_create with collection and values for each one instead. Every row's values are checked before anything is written; a row whose body is refused (say, a link to a missing note) is listed under failed while the others are added. Give each row a body about that row only, and put shared context in one note the rows link to.`,
      input: {
        collection: collectionArg,
        rows: z.array(newRowArg).min(1).max(MAX_NEW_ROWS),
      },
    },
    async ({ collection, rows }) => {
      const found = await resolveCollection(collection);
      await checkRowValues(
        found.id,
        rows.map((row) => row.values ?? {}),
      );
      const added: { index: number; noteId: string }[] = [];
      const failed: { index: number; title: string; error: string }[] = [];
      let anyPlaced = false;
      // Loaded once; new option names update it as rows are placed.
      const schema = { properties: await loadLiveProperties(found.id) };
      try {
        for (const [index, row] of rows.entries()) {
          try {
            const { noteId, placed } = await placeRow(found, row, schema);
            added.push({ index, noteId });
            anyPlaced ||= placed;
          } catch (error) {
            if (!(error instanceof ConnectorError)) throw error;
            failed.push({ index, title: row.title, error: error.message });
          }
        }
      } finally {
        // One notice for the batch, even when a later row throws.
        if (anyPlaced) changed(found.id);
      }
      const views = await rowViews(
        added.map((row) => row.noteId),
        schema.properties,
      );
      const notice = [
        sharedOpeningNotice(rows),
        plainRowNotice(
          await countEventRows(found.id),
          added.map((row) => row.noteId),
        ),
      ]
        .filter(Boolean)
        .join(" ");
      return {
        rows: added.map(({ index }, i) => ({ index, ...views[i]! })),
        failed,
        ...(notice ? { notice } : {}),
      };
    },
  );

  tools.write(
    "collections_set_values",
    {
      title: "Set collection values",
      description:
        "Set property values on up to 200 rows (notes already in the collection). Each row gets its own values. Missing option names are created.",
      input: {
        collection: collectionArg,
        rows: z
          .array(z.object({ id: z.string().min(1), values: valuesArg }))
          .min(1)
          .max(200),
      },
      idempotent: true,
    },
    async ({ collection, rows }) => {
      const found = await resolveCollection(collection);
      const members = await prisma.doc.findMany({
        where: { id: { in: rows.map((r) => r.id) }, collectionId: found.id },
        select: { id: true },
      });
      const inCollection = new Set(members.map((m) => m.id));
      const missing = rows
        .filter((r) => !inCollection.has(r.id))
        .map((r) => r.id);
      if (missing.length) {
        throw new ConnectorError(
          "invalid",
          `Not rows of "${found.name}": ${missing.join(", ")}. Add them with collections_add_notes first.`,
        );
      }
      // Validate everything first so a bad value writes nothing.
      await checkRowValues(
        found.id,
        rows.map((row) => row.values),
      );
      for (const row of rows)
        await setRowValues(found.id, [row.id], row.values);
      await log("collection.rows_updated", found, { rowCount: rows.length });
      changed(found.id);
      const updated = await prisma.doc.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: ROW_SELECT,
      });
      const fresh = await loadLiveProperties(found.id);
      return { rows: updated.map((row) => rowView(ctx, mapRow(row), fresh)) };
    },
  );

  tools.write(
    "collections_add_notes",
    {
      title: "Add notes to collection",
      description:
        "Make existing notes rows of a collection. Values stored for it before come back; meta keys matching property names fill the rest. A note in another collection moves, carrying values that match by name.",
      input: {
        collection: collectionArg,
        noteIds: z.array(z.string().min(1)).min(1).max(500),
      },
    },
    async ({ collection, noteIds }) => {
      const found = await resolveCollection(collection);
      await requireNotes(noteIds);
      const result = await addNotes(found.id, noteIds);
      await log("collection.notes_added", found, { rowCount: noteIds.length });
      changed(found.id);
      return {
        rows: result.rows.map((row) => rowView(ctx, row, result.properties)),
      };
    },
  );

  tools.write(
    "collections_remove_notes",
    {
      title: "Remove notes from collection",
      description:
        "Take notes out of a collection. The notes stay, and their values are kept in case they come back.",
      input: {
        collection: collectionArg,
        noteIds: z.array(z.string().min(1)).min(1).max(500),
      },
    },
    async ({ collection, noteIds }) => {
      const found = await resolveCollection(collection);
      const result = await prisma.doc.updateMany({
        where: { id: { in: noteIds }, collectionId: found.id },
        data: { collectionId: null },
      });
      await log("collection.notes_removed", found, { rowCount: result.count });
      changed(found.id);
      return { removed: result.count };
    },
  );

  tools.write(
    "collections_create_view",
    {
      title: "Create collection view",
      description:
        "A saved table, board, gallery, or calendar view with filters and sorts. With hostNoteId it becomes that note's embed: add the returned embed line to the note with notes_edit_blocks or notes_append.",
      input: {
        collection: collectionArg,
        name: z.string().trim().min(1).max(120),
        type: z.enum(VIEW_TYPES).optional(),
        where: filterArg.optional(),
        sort: sortArg.optional(),
        groupBy: z
          .string()
          .optional()
          .describe("Board: select or status property name"),
        dateProperty: z
          .string()
          .optional()
          .describe("Calendar: date property name"),
        hiddenProperties: z.array(z.string()).optional(),
        hostNoteId: z.string().optional(),
      },
    },
    async (args) => {
      const found = await resolveCollection(args.collection);
      const properties = await loadLiveProperties(found.id);
      const type = args.type ?? "table";
      if (args.hostNoteId) {
        const host = await prisma.doc.findUnique({
          where: { id: args.hostNoteId },
          select: { id: true },
        });
        if (!host)
          throw new ConnectorError(
            "not_found",
            `No note "${args.hostNoteId}".`,
          );
      }
      const config: ViewConfig = {
        ...(args.where?.length
          ? { filter: buildFilter(properties, args.where) }
          : {}),
        ...(args.sort?.length
          ? { sorts: buildSorts(properties, args.sort) }
          : {}),
        ...(args.hiddenProperties?.length
          ? {
              hiddenProperties: args.hiddenProperties.map(
                (name) => propertyByName(properties, name).id,
              ),
            }
          : {}),
      };
      if (type === "board") {
        const group = args.groupBy
          ? propertyByName(properties, args.groupBy)
          : properties.find((p) => p.kind === "status" || p.kind === "select");
        if (!group || !["status", "select"].includes(group.kind)) {
          throw new ConnectorError(
            "invalid",
            "A board needs a select or status property to group by (groupBy).",
          );
        }
        config.groupBy = group.id;
      }
      if (type === "calendar") {
        const date = args.dateProperty
          ? propertyByName(properties, args.dateProperty)
          : properties.find((p) => p.kind === "date");
        if (!date || date.kind !== "date") {
          throw new ConnectorError(
            "invalid",
            "A calendar needs a date property (dateProperty).",
          );
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
        appUrl: collectionAppUrl(ctx, found.id),
      };
    },
  );
}
