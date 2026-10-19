import { useAction } from "@solidjs/router";
import { createMemo, createSignal, type Accessor } from "solid-js";
import type { BulkMetaAction, SourcesResponse } from "../data/docs.service";
import { cleanupTitles, cleanupTitlesDryRun } from "../data/docs-cleanup";
import {
  bulkDeleteDocs,
  bulkSetSource,
  bulkUpdateMeta,
  deleteAllDocs,
  deleteBySource,
  processPathRound,
  scanRelativeImages,
} from "../data/docs.service";
import type { DocsQueryStore } from "../state/docsQuery";
import { logSearchResultOpened } from "~/services/activity/activity.actions";
import { updateDoc } from "~/services/docs.service";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
};

export type DocsIndexUi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  promptText: (
    opts: ConfirmOptions & { input?: { placeholder?: string } },
  ) => Promise<string | null>;
  notify: (title: string, type?: "success" | "info" | "error") => void;
};

const nativeUi: DocsIndexUi = {
  confirm: async (o) => confirm(o.description),
  promptText: async (o) => prompt(o.description)?.trim() || null,
  notify: (title) => alert(title),
};

export const useDocsIndexBulkActions = (args: {
  q: DocsQueryStore;
  sources: Accessor<SourcesResponse | undefined>;
  refreshDocs: () => Promise<unknown> | unknown;
  refreshSources: () => Promise<unknown> | unknown;
  /** Dialog-backed prompts; default to the browser's native ones. */
  ui?: DocsIndexUi;
}) => {
  const ui: DocsIndexUi = args.ui ?? nativeUi;
  const [visibleIds, setVisibleIds] = createSignal<string[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [showBulkMeta, setShowBulkMeta] = createSignal(false);
  const [showBulkPath, setShowBulkPath] = createSignal(false);
  const [bulkBusy, setBulkBusy] = createSignal(false);
  const [pendingPathIds, setPendingPathIds] = createSignal<string[]>([]);

  const runCleanupTitles = useAction(cleanupTitles);
  const runUpdateDoc = useAction(updateDoc);
  const runBulkSetSource = useAction(bulkSetSource);
  const runDeleteBySource = useAction(deleteBySource);
  const runDeleteAllDocs = useAction(deleteAllDocs);
  const runProcessPathRound = useAction(processPathRound);
  const runScanRelativeImages = useAction(scanRelativeImages);
  const runBulkDeleteDocs = useAction(bulkDeleteDocs);
  const runBulkUpdateMeta = useAction(bulkUpdateMeta);
  const runLogSearchResultOpened = useAction(logSearchResultOpened);

  const selectedVisibleCount = createMemo(() => {
    const selected = selectedIds();
    let count = 0;
    for (const id of visibleIds()) if (selected.has(id)) count++;
    return count;
  });

  const handleToggleSelect = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const nextSet = new Set(prev);
      if (next) nextSet.add(id);
      else nextSet.delete(id);
      return nextSet;
    });
  };

  const handleSetSelected = (ids: string[], next: boolean) => {
    if (!ids.length) return;
    setSelectedIds((prev) => {
      const nextSet = new Set(prev);
      for (const id of ids) {
        if (next) nextSet.add(id);
        else nextSet.delete(id);
      }
      return nextSet;
    });
  };

  const handleSelectAllVisible = () => {
    const ids = visibleIds();
    if (!ids.length) return;
    setSelectedIds(new Set(ids));
  };

  const handleSelectNone = () => {
    if (selectedIds().size === 0) return;
    setSelectedIds(new Set<string>());
  };

  const handleBulkSetSource = async () => {
    const source = await ui.promptText({
      title: "Set source on all notes",
      description: "Every note's original source will be set to this value.",
      confirmLabel: "Set source",
      input: { placeholder: "originalSource" },
    });
    if (!source) return;
    await runBulkSetSource(source);
    await args.refreshDocs();
  };

  const handleSearchResultOpen = (id: string) => {
    const query = args.q.searchText().trim();
    if (!query) return;
    const tokenCount = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2).length;
    void runLogSearchResultOpened({
      docId: id,
      queryPreview: query.slice(0, 120),
      queryLength: query.length,
      tokenCount,
    });
  };

  const handleCleanupTitles = async () => {
    const pre = await cleanupTitlesDryRun();
    const count = Number(pre.candidates || 0);
    if (!count) {
      ui.notify("No titles need cleaning.", "info");
      return;
    }
    if (
      !(await ui.confirm({
        title: `Clean ${count} titles?`,
        description:
          "Long hex-like blocks will be removed from these note titles.",
        confirmLabel: "Clean titles",
      }))
    )
      return;
    await runCleanupTitles();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleDeleteBySource = async (source: string, count: number) => {
    if (
      !(await ui.confirm({
        title: `Delete ${count} notes from ${source}?`,
        description:
          "Every note imported from this source is deleted. This cannot be undone.",
        confirmLabel: "Delete notes",
        danger: true,
      }))
    )
      return;
    await runDeleteBySource(source);
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleProcessPathRound = async () => {
    const res = await runProcessPathRound();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
    ui.notify(
      `Path round done: ${res.updated} updated, ${res.failed} failed.`,
      res.failed ? "error" : "success",
    );
  };

  const handleDeleteAll = async () => {
    const total = args.sources()?.total ?? 0;
    if (
      !(await ui.confirm({
        title: `Delete all ${total} notes?`,
        description: "Every note is deleted. This cannot be undone.",
        confirmLabel: "Delete all notes",
        danger: true,
      }))
    )
      return;
    await runDeleteAllDocs();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleDeleteSelected = async () => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      ui.notify("Select notes to delete first.", "info");
      return;
    }
    if (
      !(await ui.confirm({
        title: `Delete ${count} selected ${count === 1 ? "note" : "notes"}?`,
        description: "This cannot be undone.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await runBulkDeleteDocs(ids);
    setSelectedIds((prev) => {
      const nextSet = new Set(prev);
      for (const id of ids) nextSet.delete(id);
      return nextSet;
    });
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleOpenBulkMeta = () => setShowBulkMeta(true);
  const handleCloseBulkMeta = () => {
    if (bulkBusy()) return;
    setShowBulkMeta(false);
  };

  const handleOpenBulkPath = () => setShowBulkPath(true);
  const handleCloseBulkPath = () => {
    if (bulkBusy()) return;
    setShowBulkPath(false);
    setPendingPathIds([]);
  };

  const handleApplyBulkMeta = async (
    actions: BulkMetaAction[],
  ): Promise<boolean> => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      throw new Error("No selected visible notes. Review the selection.");
    }
    if (
      !(await ui.confirm({
        title: `Update meta on ${count} ${count === 1 ? "note" : "notes"}?`,
        description: `${actions.length} ${actions.length === 1 ? "change" : "changes"} will be applied to each selected note.`,
        confirmLabel: "Apply",
      }))
    )
      return false;
    setBulkBusy(true);
    try {
      let result: Awaited<ReturnType<typeof runBulkUpdateMeta>>;
      try {
        result = await runBulkUpdateMeta(ids, actions);
      } catch (error) {
        try {
          await args.refreshDocs();
        } catch {
          // Keep the action error. The write may have completed before its response failed.
        }
        throw error;
      }
      let refreshError: unknown;
      try {
        await args.refreshDocs();
      } catch (error) {
        refreshError = error;
      }
      if (result.updated < count) {
        setSelectedIds(new Set<string>());
        throw new Error(
          `Updated ${result.updated} of ${count} notes.${refreshError ? ` Results could not refresh: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}.` : " Results were refreshed."} Selection was cleared. The server did not report which notes failed. Review the results and reselect notes before applying again.`,
        );
      }
      if (refreshError) {
        throw new Error(
          `Updated ${result.updated} of ${count} notes, but results could not refresh: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}.`,
        );
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setShowBulkMeta(false);
      return true;
    } finally {
      setBulkBusy(false);
    }
  };

  const handleApplyBulkPath = async (path: string) => {
    const ids = pendingPathIds().length
      ? pendingPathIds()
      : visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      throw new Error("No selected visible notes.");
    }
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => runUpdateDoc({ id, path })),
      );
      const succeededIds = ids.filter(
        (id, index) =>
          results[index].status === "fulfilled" &&
          results[index].value?.id === id,
      );
      const failedIds = ids.filter((id, index) => {
        const result = results[index];
        return result.status === "rejected" || result.value?.id !== id;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of succeededIds) next.delete(id);
        for (const id of failedIds) next.add(id);
        return next;
      });
      setPendingPathIds(failedIds);
      let refreshError: unknown;
      try {
        await args.refreshDocs();
      } catch (error) {
        refreshError = error;
      }
      if (failedIds.length) {
        throw new Error(
          `Updated paths for ${succeededIds.length} of ${count} notes.${refreshError ? ` Results could not refresh: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}.` : " Results were refreshed."} Failed notes remain selected for retry.`,
        );
      }
      if (refreshError) {
        throw new Error(
          `Updated paths for ${succeededIds.length} of ${count} notes, but results could not refresh: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}.`,
        );
      }
      setShowBulkPath(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleScanRelativeImages = async () => {
    const pre = await runScanRelativeImages({ dryRun: true });
    const count = Number(pre.matches || 0);
    if (!count) {
      ui.notify("No notes have relative image links.", "info");
      return;
    }
    if (
      !(await ui.confirm({
        title: `Mark ${count} notes with relative images?`,
        description: "Sets meta has_relative_image=true on each matching note.",
        confirmLabel: "Mark notes",
      }))
    )
      return;
    const res = await runScanRelativeImages({});
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
    ui.notify(
      `Marked ${res.updated ?? 0} notes, ${res.failed ?? 0} failed.`,
      res.failed ? "error" : "success",
    );
  };

  return {
    visibleIds,
    selectedIds,
    selectedVisibleCount,
    showBulkMeta,
    showBulkPath,
    setVisibleIds,
    handleToggleSelect,
    handleSetSelected,
    handleSelectAllVisible,
    handleSelectNone,
    handleBulkSetSource,
    handleSearchResultOpen,
    handleCleanupTitles,
    handleDeleteBySource,
    handleProcessPathRound,
    handleDeleteAll,
    handleDeleteSelected,
    handleOpenBulkMeta,
    handleCloseBulkMeta,
    handleOpenBulkPath,
    handleCloseBulkPath,
    handleApplyBulkMeta,
    handleApplyBulkPath,
    handleScanRelativeImages,
  };
};
