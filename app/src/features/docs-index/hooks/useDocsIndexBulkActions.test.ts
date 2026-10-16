import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourcesResponse } from "../data/docs.service";
import { bulkSetSource, bulkUpdateMeta } from "../data/docs.service";
import { updateDoc } from "~/services/docs.service";
import { useDocsIndexBulkActions } from "./useDocsIndexBulkActions";

vi.mock("@solidjs/router", () => ({ useAction: (action: unknown) => action }));
vi.mock("../data/docs-cleanup", () => ({
  cleanupTitles: vi.fn(),
  cleanupTitlesDryRun: vi.fn(),
}));
vi.mock("../data/docs.service", () => ({
  bulkDeleteDocs: vi.fn(),
  bulkSetSource: vi.fn(),
  bulkUpdateMeta: vi.fn(),
  deleteAllDocs: vi.fn(),
  deleteBySource: vi.fn(),
  processPathRound: vi.fn(),
  scanRelativeImages: vi.fn(),
}));
vi.mock("~/services/activity/activity.actions", () => ({
  logSearchResultOpened: vi.fn(),
}));
vi.mock("~/services/docs.service", () => ({ updateDoc: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("useDocsIndexBulkActions bulk path", () => {
  it("keeps an empty fulfilled path response selected for retry", async () => {
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined as never);
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs: vi.fn(),
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1"]);
    actions.handleToggleSelect("note-1", true);
    actions.handleOpenBulkPath();

    await expect(actions.handleApplyBulkPath("/new/path")).rejects.toThrow(
      "Updated paths for 0 of 1 notes. Results were refreshed. Failed notes remain selected for retry.",
    );
    expect(actions.selectedIds()).toEqual(new Set(["note-1"]));
    expect(actions.showBulkPath()).toBe(true);
    dispose();
  });

  it("closes the path modal after a matching update acknowledgement", async () => {
    vi.mocked(updateDoc).mockResolvedValueOnce({
      id: "note-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs: vi.fn(),
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1"]);
    actions.handleToggleSelect("note-1", true);
    actions.handleOpenBulkPath();

    await actions.handleApplyBulkPath("/new/path");
    expect(actions.selectedIds()).toEqual(new Set());
    expect(actions.showBulkPath()).toBe(false);
    dispose();
  });

  it("keeps failed path updates selected and retries only those IDs", async () => {
    const refreshDocs = vi.fn();
    vi.mocked(updateDoc).mockRejectedValueOnce(new Error("write failed"));
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1"]);
    actions.handleToggleSelect("note-1", true);

    await expect(actions.handleApplyBulkPath("/new/path")).rejects.toThrow(
      "Updated paths for 0 of 1 notes. Results were refreshed. Failed notes remain selected for retry.",
    );
    expect(actions.selectedIds()).toEqual(new Set(["note-1"]));
    expect(refreshDocs).toHaveBeenCalledOnce();

    actions.setVisibleIds(["note-2"]);
    vi.mocked(updateDoc).mockResolvedValueOnce({
      id: "note-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await actions.handleApplyBulkPath("/new/path");
    expect(updateDoc).toHaveBeenLastCalledWith({
      id: "note-1",
      path: "/new/path",
    });
    expect(actions.selectedIds()).toEqual(new Set());
    dispose();
  });

  it("keeps the path write count when results cannot refresh", async () => {
    const refreshDocs = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh failed"));
    vi.mocked(updateDoc)
      .mockResolvedValueOnce({
        id: "note-1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("write failed"));
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1", "note-2"]);
    actions.handleToggleSelect("note-1", true);
    actions.handleToggleSelect("note-2", true);

    await expect(actions.handleApplyBulkPath("/new/path")).rejects.toThrow(
      "Updated paths for 1 of 2 notes. Results could not refresh: refresh failed. Failed notes remain selected for retry.",
    );
    expect(actions.selectedIds()).toEqual(new Set(["note-2"]));
    expect(refreshDocs).toHaveBeenCalledOnce();
    dispose();
  });

  it("reports partial metadata counts and clears selection for review", async () => {
    const refreshDocs = vi.fn();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(bulkUpdateMeta).mockResolvedValueOnce({
      ok: true,
      updated: 1,
    });
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1", "note-2"]);
    actions.handleToggleSelect("note-1", true);
    actions.handleToggleSelect("note-2", true);

    await expect(
      actions.handleApplyBulkMeta([{ type: "add", key: "tag", value: "x" }]),
    ).rejects.toThrow(
      "Updated 1 of 2 notes. Results were refreshed. Selection was cleared. The server did not report which notes failed. Review the results and reselect notes before applying again.",
    );
    expect(refreshDocs).toHaveBeenCalledOnce();
    expect(actions.selectedIds()).toEqual(new Set());
    dispose();
  });

  it("keeps the metadata write count when results cannot refresh", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(bulkUpdateMeta).mockResolvedValueOnce({
      ok: true,
      updated: 1,
    });
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs: vi.fn().mockRejectedValueOnce(new Error("refresh failed")),
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1", "note-2"]);
    actions.handleToggleSelect("note-1", true);
    actions.handleToggleSelect("note-2", true);

    await expect(
      actions.handleApplyBulkMeta([{ type: "add", key: "tag", value: "x" }]),
    ).rejects.toThrow(
      "Updated 1 of 2 notes. Results could not refresh: refresh failed. Selection was cleared. The server did not report which notes failed. Review the results and reselect notes before applying again.",
    );
    dispose();
  });

  it("refreshes after a rejected metadata action and preserves its error", async () => {
    const actionError = new Error("action response failed");
    const refreshDocs = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh failed"));
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(bulkUpdateMeta).mockRejectedValueOnce(actionError);
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1"]);
    actions.handleToggleSelect("note-1", true);

    await expect(
      actions.handleApplyBulkMeta([
        { type: "update", key: "tag", value: "review" },
      ]),
    ).rejects.toBe(actionError);
    expect(refreshDocs).toHaveBeenCalledOnce();
    dispose();
  });

  it("keeps the metadata draft unapplied when confirmation is canceled", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const refreshDocs = vi.fn();
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });
    actions.setVisibleIds(["note-1"]);
    actions.handleToggleSelect("note-1", true);

    await expect(
      actions.handleApplyBulkMeta([{ type: "add", key: "tag", value: "x" }]),
    ).resolves.toBe(false);
    expect(bulkUpdateMeta).not.toHaveBeenCalled();
    expect(refreshDocs).not.toHaveBeenCalled();
    dispose();
  });

  it("does not set a blank source prompt", async () => {
    vi.stubGlobal("prompt", vi.fn(() => " \t "));
    const refreshDocs = vi.fn();
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });

    await actions.handleBulkSetSource();

    expect(bulkSetSource).not.toHaveBeenCalled();
    expect(refreshDocs).not.toHaveBeenCalled();
    dispose();
  });

  it("trims a padded source prompt before setting it", async () => {
    vi.stubGlobal("prompt", vi.fn(() => "  importer  "));
    const refreshDocs = vi.fn();
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs,
        refreshSources: vi.fn(),
      });
    });

    await actions.handleBulkSetSource();

    expect(bulkSetSource).toHaveBeenCalledWith("importer");
    expect(refreshDocs).toHaveBeenCalledOnce();
    dispose();
  });

  it("rejects metadata apply when no visible notes are selected", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs: vi.fn(),
        refreshSources: vi.fn(),
      });
    });

    await expect(
      actions.handleApplyBulkMeta([{ type: "add", key: "tag", value: "x" }]),
    ).rejects.toThrow("No selected visible notes. Review the selection.");
    expect(bulkUpdateMeta).not.toHaveBeenCalled();
    dispose();
  });

  it("rejects when no visible notes are selected", async () => {
    let dispose!: () => void;
    const actions = createRoot((stop) => {
      dispose = stop;
      return useDocsIndexBulkActions({
        q: { searchText: () => "" } as never,
        sources: () => undefined as SourcesResponse | undefined,
        refreshDocs: vi.fn(),
        refreshSources: vi.fn(),
      });
    });

    await expect(actions.handleApplyBulkPath("/new/path")).rejects.toThrow(
      "No selected visible notes.",
    );
    dispose();
  });
});
