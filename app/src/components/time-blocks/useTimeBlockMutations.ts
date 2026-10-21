import { useAction } from "@solidjs/router";
import { createEffect, createSignal, type Accessor } from "solid-js";
import {
  bulkUpdateTimeBlocks,
  createTimeBlock,
  deleteTimeBlock,
  duplicateTimeBlock,
  updateTimeBlock,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import type { TimeUpdate } from "./compact-day";

type Patch = Partial<
  Pick<TimeBlockItem, "startTime" | "endTime" | "title" | "isFixedTime">
>;

/**
 * Server writes for the calendar with optimistic overlays, so drags, renames
 * and toggles show immediately and roll back if the write fails.
 */
export const useTimeBlockMutations = (
  serverBlocks: Accessor<TimeBlockItem[] | undefined>,
  refresh: () => void,
) => {
  const [patches, setPatches] = createSignal<Record<string, Patch>>({});
  const [hiddenIds, setHiddenIds] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  // Writes in flight; each refreshes when it lands, which also picks up any
  // change an agent or another tab made meanwhile.
  const [pendingWrites, setPendingWrites] = createSignal(0);
  const tracked = async <T>(write: () => Promise<T>): Promise<T> => {
    setPendingWrites((count) => count + 1);
    try {
      return await write();
    } finally {
      setPendingWrites((count) => count - 1);
    }
  };
  const runCreate = useAction(createTimeBlock);
  const runUpdate = useAction(updateTimeBlock);
  const runBulkUpdate = useAction(bulkUpdateTimeBlocks);
  const runDuplicate = useAction(duplicateTimeBlock);
  const runDelete = useAction(deleteTimeBlock);

  const blocks = () => {
    const source = serverBlocks() ?? [];
    const overlay = patches();
    const hidden = hiddenIds();
    return source
      .filter((block) => !hidden.has(block.id))
      .map((block) =>
        overlay[block.id] ? { ...block, ...overlay[block.id] } : block,
      );
  };

  // Drop overlays once the server data agrees with them.
  createEffect(() => {
    const source = serverBlocks();
    if (!source) return;
    const byId = new Map(source.map((block) => [block.id, block]));
    setPatches((current) => {
      const next: Record<string, Patch> = {};
      for (const [id, patch] of Object.entries(current)) {
        const server = byId.get(id);
        if (!server) continue;
        const settled = (Object.keys(patch) as Array<keyof Patch>).every(
          (key) => server[key] === patch[key],
        );
        if (!settled) next[id] = patch;
      }
      return next;
    });
  });

  const withRollback = async (ids: string[], write: () => Promise<unknown>) => {
    try {
      await tracked(write);
    } catch (error) {
      console.error("[time-blocks] write failed", error);
      setPatches((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        return next;
      });
      setHiddenIds((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
    refresh();
  };

  const patch = (id: string, value: Patch) =>
    setPatches((current) => ({
      ...current,
      [id]: { ...current[id], ...value },
    }));

  const setTimes = (block: TimeBlockItem, start: Date, end: Date) => {
    const startTimeIso = start.toISOString();
    const endTimeIso = end.toISOString();
    patch(block.id, { startTime: startTimeIso, endTime: endTimeIso });
    return withRollback([block.id], () =>
      runUpdate({ id: block.id, startTimeIso, endTimeIso }),
    );
  };

  const setMany = (updates: TimeUpdate[]) => {
    if (updates.length === 0) return Promise.resolve();
    for (const update of updates) {
      patch(update.id, {
        startTime: update.startTimeIso,
        endTime: update.endTimeIso,
      });
    }
    return withRollback(
      updates.map((update) => update.id),
      () => runBulkUpdate(updates),
    );
  };

  const rename = (block: TimeBlockItem, title: string) => {
    patch(block.id, { title });
    return withRollback([block.id], () => runUpdate({ id: block.id, title }));
  };

  const toggleFixed = (block: TimeBlockItem) => {
    const isFixedTime = !block.isFixedTime;
    patch(block.id, { isFixedTime });
    return withRollback([block.id], () =>
      runUpdate({ id: block.id, isFixedTime }),
    );
  };

  const remove = (block: TimeBlockItem) => {
    setHiddenIds((current) => new Set(current).add(block.id));
    return withRollback([block.id], () => runDelete({ id: block.id }));
  };

  const duplicate = async (block: TimeBlockItem, start: Date, end: Date) => {
    await tracked(() =>
      runDuplicate({
        id: block.id,
        startTimeIso: start.toISOString(),
        endTimeIso: end.toISOString(),
      }),
    ).catch((error) => console.error("[time-blocks] duplicate failed", error));
    refresh();
  };

  const create = async (input: {
    title: string;
    start: Date;
    end: Date;
    color: string;
    noteId?: string;
  }) => {
    const created = await tracked(() =>
      runCreate({
        title: input.title,
        startTimeIso: input.start.toISOString(),
        endTimeIso: input.end.toISOString(),
        color: input.color,
        noteId: input.noteId ?? null,
      }),
    );
    refresh();
    return created.id;
  };

  return {
    blocks,
    writing: () => pendingWrites() > 0,
    setTimes,
    setMany,
    rename,
    toggleFixed,
    remove,
    duplicate,
    create,
  };
};
