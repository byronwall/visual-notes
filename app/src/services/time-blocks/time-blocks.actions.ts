import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";

const isoString = z.string().min(1);

const createInput = z.object({
  title: z.string().max(200).optional(),
  startTimeIso: isoString,
  endTimeIso: isoString,
  color: z.string().max(64).optional(),
  isFixedTime: z.boolean().optional(),
  comments: z.string().max(4000).optional(),
  noteId: z.string().optional().nullable(),
});

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  startTimeIso: isoString.optional(),
  endTimeIso: isoString.optional(),
  color: z.string().max(64).optional().nullable(),
  isFixedTime: z.boolean().optional(),
  comments: z.string().max(4000).optional().nullable(),
  noteId: z.string().optional().nullable(),
});

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
  })
);

const deleteByRangeInput = z.object({
  startIso: isoString,
  endIso: isoString,
});

const createMetaInput = z.object({
  dateIso: isoString,
  key: z.string().min(1).max(128),
  value: z.string().min(1).max(4000),
  contributor: z.string().min(1).max(80).default("default"),
  comments: z.string().max(4000).optional(),
  noteId: z.string().optional().nullable(),
});

const updateMetaInput = z.object({
  id: z.string().min(1),
  value: z.string().min(1).max(4000),
  comments: z.string().max(4000).optional().nullable(),
  noteId: z.string().optional().nullable(),
});

const deleteMetaInput = z.object({ id: z.string().min(1) });

const parseIsoDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label}`);
  return date;
};

const normalizeRange = (start: Date, end: Date) => {
  if (end.getTime() >= start.getTime()) return { start, end };
  return { start: end, end: start };
};

export const createTimeBlock = action(
  async (payload: z.infer<typeof createInput>) => {
    "use server";
    const input = createInput.parse(payload);
    const start = parseIsoDate(input.startTimeIso, "startTimeIso");
    const end = parseIsoDate(input.endTimeIso, "endTimeIso");
    const normalized = normalizeRange(start, end);
    const created = await prisma.timeBlock.create({
      data: {
        title: input.title?.trim() || "Untitled Block",
        startTime: normalized.start,
        endTime: normalized.end,
        color: input.color?.trim() || null,
        isFixedTime: input.isFixedTime ?? false,
        comments: input.comments?.trim() || null,
        noteId: input.noteId?.trim() || null,
      },
      select: { id: true },
    });
    return created;
  },
  "time-block-create"
);

export const updateTimeBlock = action(
  async (payload: z.infer<typeof updateInput>) => {
    "use server";
    const input = updateInput.parse(payload);

    const existing = await prisma.timeBlock.findUnique({
      where: { id: input.id },
      select: { startTime: true, endTime: true },
    });
    if (!existing) throw new Error("Time block not found");

    const start = input.startTimeIso
      ? parseIsoDate(input.startTimeIso, "startTimeIso")
      : existing.startTime;
    const end = input.endTimeIso
      ? parseIsoDate(input.endTimeIso, "endTimeIso")
      : existing.endTime;
    const normalized = normalizeRange(start, end);

    const updated = await prisma.timeBlock.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() || null } : {}),
        ...(input.color !== undefined
          ? { color: input.color?.trim() || null }
          : {}),
        ...(input.isFixedTime !== undefined
          ? { isFixedTime: input.isFixedTime }
          : {}),
        ...(input.comments !== undefined
          ? { comments: input.comments?.trim() || null }
          : {}),
        ...(input.noteId !== undefined ? { noteId: input.noteId?.trim() || null } : {}),
        startTime: normalized.start,
        endTime: normalized.end,
      },
      select: { id: true, updatedAt: true },
    });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "time-block-update"
);

export const deleteTimeBlock = action(
  async (payload: z.infer<typeof deleteInput>) => {
    "use server";
    const input = deleteInput.parse(payload);
    const deleted = await prisma.timeBlock
      .delete({ where: { id: input.id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) throw new Error("Time block not found");
    return { ok: true, id: deleted.id };
  },
  "time-block-delete"
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
      parseIsoDate(input.endTimeIso, "endTimeIso")
    );

    const created = await prisma.timeBlock.create({
      data: {
        title: existing.title,
        color: existing.color,
        isFixedTime: existing.isFixedTime,
        comments: existing.comments,
        noteId: existing.noteId,
        startTime: normalized.start,
        endTime: normalized.end,
      },
      select: { id: true },
    });
    return created;
  },
  "time-block-duplicate"
);

export const bulkUpdateTimeBlocks = action(
  async (payload: z.infer<typeof bulkUpdateInput>) => {
    "use server";
    const updates = bulkUpdateInput.parse(payload);
    return prisma.$transaction(
      updates.map((update) => {
        const normalized = normalizeRange(
          parseIsoDate(update.startTimeIso, "startTimeIso"),
          parseIsoDate(update.endTimeIso, "endTimeIso")
        );
        return prisma.timeBlock.update({
          where: { id: update.id },
          data: {
            startTime: normalized.start,
            endTime: normalized.end,
          },
          select: { id: true },
        });
      })
    );
  },
  "time-block-bulk-update"
);

export const deleteTimeBlocksByDateRange = action(
  async (payload: z.infer<typeof deleteByRangeInput>) => {
    "use server";
    const input = deleteByRangeInput.parse(payload);
    const start = parseIsoDate(input.startIso, "startIso");
    const end = parseIsoDate(input.endIso, "endIso");
    const normalized = normalizeRange(start, end);
    const result = await prisma.timeBlock.deleteMany({
      where: {
        startTime: {
          gte: normalized.start,
          lt: normalized.end,
        },
      },
    });
    return { count: result.count };
  },
  "time-block-delete-range"
);

export const createTimeBlockDayMeta = action(
  async (payload: z.infer<typeof createMetaInput>) => {
    "use server";
    const input = createMetaInput.parse(payload);
    const date = parseIsoDate(input.dateIso, "dateIso");
    return prisma.timeBlockDayMetadata.upsert({
      where: {
        date_key_contributor: {
          date,
          key: input.key.trim(),
          contributor: input.contributor.trim() || "default",
        },
      },
      update: {
        value: input.value,
        comments: input.comments?.trim() || null,
        noteId: input.noteId?.trim() || null,
      },
      create: {
        date,
        key: input.key.trim(),
        value: input.value,
        contributor: input.contributor.trim() || "default",
        comments: input.comments?.trim() || null,
        noteId: input.noteId?.trim() || null,
      },
      select: { id: true },
    });
  },
  "time-block-day-meta-create"
);

export const updateTimeBlockDayMeta = action(
  async (payload: z.infer<typeof updateMetaInput>) => {
    "use server";
    const input = updateMetaInput.parse(payload);
    return prisma.timeBlockDayMetadata.update({
      where: { id: input.id },
      data: {
        value: input.value,
        ...(input.comments !== undefined
          ? { comments: input.comments?.trim() || null }
          : {}),
        ...(input.noteId !== undefined ? { noteId: input.noteId?.trim() || null } : {}),
      },
      select: { id: true, updatedAt: true },
    });
  },
  "time-block-day-meta-update"
);

export const deleteTimeBlockDayMeta = action(
  async (payload: z.infer<typeof deleteMetaInput>) => {
    "use server";
    const input = deleteMetaInput.parse(payload);
    await prisma.timeBlockDayMetadata.delete({ where: { id: input.id } });
    return { ok: true, id: input.id };
  },
  "time-block-day-meta-delete"
);
