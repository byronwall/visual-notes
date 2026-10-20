import { useAction } from "@solidjs/router";
import { batch, createEffect, on } from "solid-js";
import { createStore, produce, reconcile, unwrap } from "solid-js/store";
import { useToasts } from "~/components/Toast";
import type {
  CollectionBundle,
  CollectionProperty,
  CollectionRow,
  CollectionView,
  PropertyConfig,
  PropertyKind,
  PropertyValue,
  SelectOption,
  ViewConfig,
  ViewType,
} from "~/lib/collections/types";
import {
  createProperty,
  createRow,
  createSelectOption,
  createView,
  deleteProperty,
  deleteRows,
  deleteView,
  moveRow,
  removeRowsFromCollection,
  reorderProperties,
  setRowProperties,
  setRowTitle,
  updateCollection,
  updateProperty,
  updateView,
} from "~/services/collections/collections.actions";

export type CollectionState = {
  collection: CollectionBundle["collection"];
  properties: CollectionProperty[];
  views: CollectionView[];
  rows: CollectionRow[];
  today: string;
};

// Store values are proxies; snapshot them as plain data.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(unwrap(value))) as T;

const fromBundle = (b: CollectionBundle): CollectionState => ({
  collection: b.collection,
  properties: b.properties,
  views: b.views,
  rows: b.rows,
  today: b.today,
});

/**
 * Client store for one collection. Edits apply locally first and are rolled
 * back with a toast if the server rejects them. A fresh bundle (navigation or
 * revalidation) reconciles into the store.
 */
export function createCollectionStore(bundle: () => CollectionBundle | null | undefined) {
  const initial = bundle();
  const [state, setState] = createStore<CollectionState>(
    initial
      ? fromBundle(initial)
      : { collection: { id: "", name: "", description: null, icon: null }, properties: [], views: [], rows: [], today: "" },
  );
  createEffect(
    on(bundle, (next) => {
      if (next) setState(reconcile(fromBundle(next), { key: "id", merge: true }));
    }, { defer: true }),
  );

  const { show } = useToasts();
  const fail = (title: string, error: unknown) => {
    console.warn("[collections] %s", title, error);
    show({ title, message: error instanceof Error ? error.message : String(error), type: "error" });
  };

  const run = {
    setValues: useAction(setRowProperties),
    setTitle: useAction(setRowTitle),
    createRow: useAction(createRow),
    deleteRows: useAction(deleteRows),
    removeRows: useAction(removeRowsFromCollection),
    moveRow: useAction(moveRow),
    createProperty: useAction(createProperty),
    updateProperty: useAction(updateProperty),
    deleteProperty: useAction(deleteProperty),
    reorderProperties: useAction(reorderProperties),
    createOption: useAction(createSelectOption),
    createView: useAction(createView),
    updateView: useAction(updateView),
    deleteView: useAction(deleteView),
    updateCollection: useAction(updateCollection),
  };

  const rowIndex = (id: string) => state.rows.findIndex((r) => r.id === id);
  const snapshotRows = (ids: string[]) =>
    ids.map((id) => state.rows.find((r) => r.id === id)).filter(Boolean).map((r) => clone(r!));

  const restoreRows = (snap: CollectionRow[]) =>
    setState(
      produce((s) => {
        for (const row of snap) {
          const i = s.rows.findIndex((r) => r.id === row.id);
          if (i >= 0) s.rows[i] = row;
          else s.rows.push(row);
        }
      }),
    );

  const viewSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const api = {
    state,

    async setValues(rowIds: string[], patch: Record<string, PropertyValue>) {
      if (!rowIds.length) return;
      const snap = snapshotRows(rowIds);
      setState(
        produce((s) => {
          for (const row of s.rows) {
            if (!rowIds.includes(row.id)) continue;
            for (const [key, value] of Object.entries(patch)) {
              if (value === null) delete row.properties[key];
              else row.properties[key] = value;
            }
          }
        }),
      );
      try {
        const result = await run.setValues({ collectionId: state.collection.id, docIds: rowIds, patch });
        setState(
          produce((s) => {
            for (const row of s.rows) {
              const at = result.updatedAt[row.id];
              if (at) row.updatedAt = at;
            }
          }),
        );
      } catch (error) {
        restoreRows(snap);
        fail("Couldn't save the change", error);
      }
    },

    async setTitle(rowId: string, title: string) {
      const i = rowIndex(rowId);
      if (i < 0) return;
      const previous = state.rows[i]!.title;
      const next = title.trim() || "Untitled";
      if (next === previous) return;
      setState("rows", i, "title", next);
      try {
        const result = await run.setTitle({ docId: rowId, title: next });
        setState("rows", (r) => r.id === rowId, "updatedAt", result.updatedAt);
      } catch (error) {
        setState("rows", (r) => r.id === rowId, "title", previous);
        fail("Couldn't rename the row", error);
      }
    },

    async addRow(init: {
      title?: string;
      properties?: Record<string, PropertyValue>;
      afterRank?: string | null;
      beforeRank?: string | null;
    } = {}): Promise<CollectionRow | undefined> {
      try {
        const row = await run.createRow({ collectionId: state.collection.id, ...init });
        setState("rows", (rows) => [...rows, row]);
        return row;
      } catch (error) {
        fail("Couldn't add a row", error);
        return undefined;
      }
    },

    async deleteRows(ids: string[]) {
      const snap = snapshotRows(ids);
      setState("rows", (rows) => rows.filter((r) => !ids.includes(r.id)));
      try {
        await run.deleteRows({ collectionId: state.collection.id, docIds: ids });
      } catch (error) {
        restoreRows(snap);
        fail("Couldn't delete rows", error);
      }
    },

    async removeRows(ids: string[]) {
      const snap = snapshotRows(ids);
      setState("rows", (rows) => rows.filter((r) => !ids.includes(r.id)));
      try {
        await run.removeRows({ collectionId: state.collection.id, docIds: ids });
      } catch (error) {
        restoreRows(snap);
        fail("Couldn't remove rows", error);
      }
    },

    async moveRow(rowId: string, afterRank: string | null, beforeRank: string | null, patch?: Record<string, PropertyValue>) {
      const snap = snapshotRows([rowId]);
      try {
        const pending = run.moveRow({ collectionId: state.collection.id, docId: rowId, afterRank, beforeRank });
        if (patch) void api.setValues([rowId], patch);
        const { rank } = await pending;
        setState("rows", (r) => r.id === rowId, "rank", rank);
      } catch (error) {
        restoreRows(snap);
        fail("Couldn't move the row", error);
      }
    },

    async addProperty(kind: PropertyKind, name: string, config?: PropertyConfig) {
      try {
        const property = await run.createProperty({ collectionId: state.collection.id, kind, name, config });
        setState("properties", (ps) => [...ps, property]);
        return property;
      } catch (error) {
        fail("Couldn't add the property", error);
        return undefined;
      }
    },

    async updateProperty(id: string, patch: { name?: string; config?: PropertyConfig }) {
      const i = state.properties.findIndex((p) => p.id === id);
      if (i < 0) return;
      const previous = clone(state.properties[i]!);
      batch(() => {
        if (patch.name !== undefined) setState("properties", i, "name", patch.name);
        if (patch.config !== undefined) setState("properties", i, "config", reconcile(patch.config));
      });
      try {
        await run.updateProperty({ id, ...patch });
      } catch (error) {
        setState("properties", (p) => p.id === id, previous);
        fail("Couldn't update the property", error);
      }
    },

    /** Replaces a property after a server-side change such as a type change. */
    replaceProperty(property: CollectionProperty) {
      setState("properties", (p) => p.id === property.id, reconcile(property));
    },

    /** Mirrors a title saved elsewhere (e.g. the peek panel header). */
    applyLocalTitle(rowId: string, title: string) {
      setState("rows", (r) => r.id === rowId, "title", title);
    },

    replaceRows(rows: CollectionRow[]) {
      setState("rows", reconcile(rows, { key: "id" }));
    },

    async deleteProperty(id: string) {
      const previous = state.properties;
      setState("properties", (ps) => ps.filter((p) => p.id !== id));
      try {
        await run.deleteProperty(id);
      } catch (error) {
        setState("properties", previous);
        fail("Couldn't delete the property", error);
      }
    },

    async reorderProperties(ids: string[]) {
      setState(
        "properties",
        produce((ps) => {
          ps.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
          ps.forEach((p, i) => (p.position = i));
        }),
      );
      try {
        await run.reorderProperties({ collectionId: state.collection.id, propertyIds: ids });
      } catch (error) {
        fail("Couldn't reorder properties", error);
      }
    },

    async createOption(propertyId: string, name: string, extra?: Partial<SelectOption>): Promise<SelectOption | undefined> {
      try {
        const { option, property } = await run.createOption({ propertyId, name, color: extra?.color, group: extra?.group });
        setState("properties", (p) => p.id === propertyId, "config", reconcile(property.config));
        return option;
      } catch (error) {
        fail("Couldn't add the option", error);
        return undefined;
      }
    },

    view(id: string | undefined) {
      return state.views.find((v) => v.id === id);
    },

    /** Updates a view's config locally now and saves it shortly after. */
    patchViewConfig(viewId: string, patch: Partial<ViewConfig>) {
      const i = state.views.findIndex((v) => v.id === viewId);
      if (i < 0) return;
      setState("views", i, "config", (config) => ({ ...config, ...patch }));
      clearTimeout(viewSaveTimers.get(viewId));
      viewSaveTimers.set(
        viewId,
        setTimeout(() => {
          const view = state.views.find((v) => v.id === viewId);
          if (!view) return;
          run.updateView({ id: viewId, config: clone(view.config) }).catch((error) =>
            fail("Couldn't save the view", error),
          );
        }, 400),
      );
    },

    async renameView(viewId: string, name: string) {
      setState("views", (v) => v.id === viewId, "name", name);
      try {
        await run.updateView({ id: viewId, name });
      } catch (error) {
        fail("Couldn't rename the view", error);
      }
    },

    async setViewType(viewId: string, type: ViewType) {
      setState("views", (v) => v.id === viewId, "type", type);
      try {
        await run.updateView({ id: viewId, type });
      } catch (error) {
        fail("Couldn't change the view", error);
      }
    },

    async addView(name: string, type: ViewType, config?: ViewConfig, hostDocId?: string | null) {
      try {
        const view = await run.createView({ collectionId: state.collection.id, name, type, config, hostDocId });
        if (!hostDocId) setState("views", (vs) => [...vs, view]);
        return view;
      } catch (error) {
        fail("Couldn't add the view", error);
        return undefined;
      }
    },

    async deleteView(viewId: string) {
      const previous = state.views;
      setState("views", (vs) => vs.filter((v) => v.id !== viewId));
      try {
        await run.deleteView(viewId);
        return true;
      } catch (error) {
        setState("views", previous);
        fail("Couldn't delete the view", error);
        return false;
      }
    },

    async renameCollection(name: string) {
      const previous = state.collection.name;
      const next = name.trim();
      if (!next || next === previous) return;
      setState("collection", "name", next);
      try {
        await run.updateCollection({ id: state.collection.id, name: next });
      } catch (error) {
        setState("collection", "name", previous);
        fail("Couldn't rename the collection", error);
      }
    },
  };
  return api;
}

export type CollectionStore = ReturnType<typeof createCollectionStore>;
