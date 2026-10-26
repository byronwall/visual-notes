import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  createTimeBlock as createTimeBlockInStore,
  type createTimeBlockInput,
  normalizeRange,
  parseIsoDate,
  setDayMeta,
  type setDayMetaInput,
  timeBlocksChanged,
  updateDayMeta,
  type updateDayMetaInput,
  updateTimeBlock as updateTimeBlockInStore,
  type updateTimeBlockInput,
} from "~/server/time-blocks/time-block-store";

// Calendar writes. Create/update and day metadata go through the shared
// store (also used over MCP); every write tells open tabs.

const isoString = z.string().min(1);

const deleteInput = z.object({ id: z.string().min(1) });

const duplicateInput = z.object({
  id: z.string().min(1),
  startTimeIso: isoString,
  endTimeIso: isoString,
});

const bulkUpdateInput = z.array(
  z.object({
    id: z.string().min(1),
    startTimeIso: isoString,
    endTimeIso: isoString,
  }),
);

const deleteByRangeInput = z.object({
  startIso: isoString,
  endIso: isoString,
});

const deleteMetaInput = z.object({ id: z.string().min(1) });

export const createTimeBlock = action(
  async (payload: z.input<typeof createTimeBlockInput>) => {
    "use server";
    return createTimeBlockInStore(payload);
  },
  "time-block-create",
);

export const updateTimeBlock = action(
  async (payload: z.input<typeof updateTimeBlockInput>) => {
    "use server";
    return updateTimeBlockInStore(payload);
  },
  "time-block-update",
);

export const deleteTimeBlock = action(
  async (payload: z.infer<typeof deleteInput>) => {
    "use server";
    const input = deleteInput.parse(payload);
    const deleted = await prisma.timeBlock
      .delete({ where: { id: input.id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) throw new Error("Time block not found");
    timeBlocksChanged([deleted.id]);
    return { ok: true, id: deleted.id };
  },
  "time-block-delete",
);

export const duplicateTimeBlock = action(
  async (payload: z.infer<typeof duplicateInput>) => {
    "use server";
    const input = duplicateInput.parse(payload);
    const existing = await prisma.timeBlock.findUnique({
      where: { id: input.id },
      select: {
        title: true,
        color: true,
        isFixedTime: true,
        comments: true,
        noteId: true,
      },
    });
    if (!existing) throw new Error("Time block not found");

    const normalized = normalizeRange(
      parseIsoDate(input.startTimeIso, "startTimeIso"),
      parseIsoDate(input.endTimeIso, "endTimeIso"),
    );

    const created = await prisma.timeBlock.create({
      data: {
        ...existing,
        startTime: normalized.start,
        endTime: normalized.end,
      },
      select: { id: true },
    });
    timeBlocksChanged([created.id]);
    return created;
  },
  "time-block-duplicate",
);

export const bulkUpdateTimeBlocks = action(
  async (payload: z.infer<typeof bulkUpdateInput>) => {
    "use server";
    const updates = bulkUpdateInput.parse(payload);
    const result = await prisma.$transaction(
      updates.map((update) => {
        const normalized = normalizeRange(
          parseIsoDate(update.startTimeIso, "startTimeIso"),
          parseIsoDate(update.endTimeIso, "endTimeIso"),
        );
        return prisma.timeBlock.update({
          where: { id: update.id },
          data: {
            startTime: normalized.start,
            endTime: normalized.end,
          },
          select: { id: true },
        });
      }),
    );
    timeBlocksChanged(result.map((row) => row.id));
    return result;
  },
  "time-block-bulk-update",
);

export const deleteTimeBlocksByDateRange = action(
  async (payload: z.infer<typeof deleteByRangeInput>) => {
    "use server";
    const input = deleteByRangeInput.parse(payload);
    const normalized = normalizeRange(
      parseIsoDate(input.startIso, "startIso"),
      parseIsoDate(input.endIso, "endIso"),
    );
    const result = await prisma.timeBlock.deleteMany({
      where: {
        startTime: {
          gte: normalized.start,
          lt: normalized.end,
        },
      },
    });
    timeBlocksChanged(null);
    return { count: result.count };
  },
  "time-block-delete-range",
);

export const createTimeBlockDayMeta = action(
  async (payload: z.input<typeof setDayMetaInput>) => {
    "use server";
    return setDayMeta(payload);
  },
  "time-block-day-meta-create",
);

export const updateTimeBlockDayMeta = action(
  async (payload: z.input<typeof updateDayMetaInput>) => {
    "use server";
    return updateDayMeta(payload);
  },
  "time-block-day-meta-update",
);

export const deleteTimeBlockDayMeta = action(
  async (payload: z.infer<typeof deleteMetaInput>) => {
    "use server";
    const input = deleteMetaInput.parse(payload);
    await prisma.timeBlockDayMetadata.delete({ where: { id: input.id } });
    timeBlocksChanged([input.id]);
    return { ok: true, id: input.id };
  },
  "time-block-day-meta-delete",
);
