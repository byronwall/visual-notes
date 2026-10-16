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

export const useDocsIndexBulkActions = (args: {
  q: DocsQueryStore;
  sources: Accessor<SourcesResponse | undefined>;
  refreshDocs: () => Promise<unknown> | unknown;
  refreshSources: () => Promise<unknown> | unknown;
}) => {
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
    const value = prompt("Enter source to set on all notes (originalSource):");
    if (!value) return;
    await runBulkSetSource(value);
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
      alert("No titles to clean.");
      return;
    }
    if (
      !confirm(
        `Clean bad titles for ${count} notes? This will remove long hex-like blocks.`,
      )
    )
      return;
    await runCleanupTitles();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleDeleteBySource = async (source: string, count: number) => {
    if (
      !confirm(
        `Delete all notes for "${source}" (${count})? This cannot be undone.`,
      )
    )
      return;
    await runDeleteBySource(source);
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleProcessPathRound = async () => {
    const res = await runProcessPathRound();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
    alert(`Processed path round. Updated: ${res.updated}, Failed: ${res.failed}.`);
  };

  const handleDeleteAll = async () => {
    const total = args.sources()?.total ?? 0;
    if (!confirm(`Delete ALL notes (${total})? This cannot be undone.`)) return;
    await runDeleteAllDocs();
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
  };

  const handleDeleteSelected = async () => {
    const ids = visibleIds().filter((id) => selectedIds().has(id));
    const count = ids.length;
    if (!count) {
      alert("No selected visible notes to delete.");
      return;
    }
    if (!confirm(`Delete the ${count} selected notes? This cannot be undone.`))
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
    if (!confirm(`Apply ${actions.length} action(s) to ${count} selected notes?`))
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
        (_, index) => results[index].status === "fulfilled",
      );
      const failedIds = ids.filter(
        (_, index) => results[index].status === "rejected",
      );
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
      alert("No notes found with relative image links.");
      return;
    }
    if (
      !confirm(
        `Mark ${count} notes with meta has_relative_image=true? This updates note metadata.`,
      )
    )
      return;
    const res = await runScanRelativeImages({});
    await Promise.all([args.refreshDocs(), args.refreshSources()]);
    alert(`Updated: ${res.updated ?? 0}, Failed: ${res.failed ?? 0}.`);
  };

  return {
    visibleIds,
    selectedIds,
    selectedVisibleCount,
    showBulkMeta,
    showBulkPath,
    setVisibleIds,
    handleToggleSelect,
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
