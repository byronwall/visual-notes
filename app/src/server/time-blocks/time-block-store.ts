import { z } from "zod";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import type {
  TimeBlockDayMetadataItem,
  TimeBlockItem,
} from "~/services/time-blocks/time-blocks.types";

// Time block and day-metadata reads and writes shared by the calendar (router
// actions in services/time-blocks/time-blocks.actions.ts) and the MCP
// connector. Every write tells open tabs through an `app:changed`
// time-blocks event.

const isoString = z.string().min(1);

export const createTimeBlockInput = z.object({
  title: z.string().max(200).optional(),
  startTimeIso: isoString,
  endTimeIso: isoString,
  color: z.string().max(64).optional(),
  isFixedTime: z.boolean().optional(),
  comments: z.string().max(4000).optional(),
  noteId: z.string().optional().nullable(),
});

export const updateTimeBlockInput = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  startTimeIso: isoString.optional(),
  endTimeIso: isoString.optional(),
  color: z.string().max(64).optional().nullable(),
  isFixedTime: z.boolean().optional(),
  comments: z.string().max(4000).optional().nullable(),
  noteId: z.string().optional().nullable(),
});

export const setDayMetaInput = z.object({
  dateIso: isoString,
  key: z.string().min(1).max(128),
  value: z.string().min(1).max(4000),
  contributor: z.string().min(1).max(80).default("default"),
  comments: z.string().max(4000).optional(),
  noteId: z.string().optional().nullable(),
});

export const updateDayMetaInput = z.object({
  id: z.string().min(1),
  value: z.string().min(1).max(4000),
  comments: z.string().max(4000).optional().nullable(),
  noteId: z.string().optional().nullable(),
});

export class TimeBlockInputError extends Error {}

export const parseIsoDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new TimeBlockInputError(`Invalid ${label}`);
  return date;
};

export const normalizeRange = (start: Date, end: Date) => {
  if (end.getTime() >= start.getTime()) return { start, end };
  return { start: end, end: start };
};

export const timeBlocksChanged = (ids: string[] | null) =>
  publishAppChange("time-blocks", ids);

const blockInclude = { note: { select: { title: true } } } as const;

type BlockRow = {
  id: string;
  title: string | null;
  startTime: Date;
  endTime: Date;
  color: string | null;
  isFixedTime: boolean;
  comments: string | null;
  noteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  note?: { title: string } | null;
};

export const mapTimeBlock = (row: BlockRow): TimeBlockItem => ({
  id: row.id,
  title: row.title,
  startTime: row.startTime.toISOString(),
  endTime: row.endTime.toISOString(),
  color: row.color,
  isFixedTime: row.isFixedTime,
  comments: row.comments,
  noteId: row.noteId,
  noteTitle: row.note?.title ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

type MetaRow = {
  id: string;
  date: Date;
  key: string;
  value: string;
  contributor: string;
  comments: string | null;
  noteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  note?: { title: string } | null;
};

export const mapDayMeta = (row: MetaRow): TimeBlockDayMetadataItem => ({
  id: row.id,
  date: row.date.toISOString(),
  key: row.key,
  value: row.value,
  contributor: row.contributor,
  comments: row.comments,
  noteId: row.noteId,
  noteTitle: row.note?.title ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Blocks starting in [start, end), optionally only those linked to a note. */
export async function listTimeBlocks(
  start: Date,
  end: Date,
  noteId?: string,
): Promise<TimeBlockItem[]> {
  const rows = await prisma.timeBlock.findMany({
    where: {
      startTime: { gte: start, lt: end },
      ...(noteId ? { noteId } : {}),
    },
    include: blockInclude,
    orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
  });
  return rows.map(mapTimeBlock);
}

export async function getTimeBlocks(ids: string[]): Promise<TimeBlockItem[]> {
  const rows = await prisma.timeBlock.findMany({
    where: { id: { in: ids } },
    include: blockInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, mapTimeBlock(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Day metadata dated within [start, end] (inclusive, like the calendar). */
export async function listDayMeta(
  start: Date,
  end: Date,
): Promise<TimeBlockDayMetadataItem[]> {
  const rows = await prisma.timeBlockDayMetadata.findMany({
    where: { date: { gte: start, lte: end } },
    include: blockInclude,
    orderBy: [{ date: "asc" }, { key: "asc" }, { contributor: "asc" }],
  });
  return rows.map(mapDayMeta);
}

export async function createTimeBlock(
  payload: z.input<typeof createTimeBlockInput>,
) {
  const input = createTimeBlockInput.parse(payload);
  const normalized = normalizeRange(
    parseIsoDate(input.startTimeIso, "startTimeIso"),
    parseIsoDate(input.endTimeIso, "endTimeIso"),
  );
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
  timeBlocksChanged([created.id]);
  return created;
}

export async function updateTimeBlock(
  payload: z.input<typeof updateTimeBlockInput>,
) {
  const input = updateTimeBlockInput.parse(payload);
  const existing = await prisma.timeBlock.findUnique({
    where: { id: input.id },
    select: { startTime: true, endTime: true },
  });
  if (!existing) throw new TimeBlockInputError("Time block not found");
  const normalized = normalizeRange(
    input.startTimeIso
      ? parseIsoDate(input.startTimeIso, "startTimeIso")
      : existing.startTime,
    input.endTimeIso
      ? parseIsoDate(input.endTimeIso, "endTimeIso")
      : existing.endTime,
  );
  const updated = await prisma.timeBlock.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined
        ? { title: input.title.trim() || null }
        : {}),
      ...(input.color !== undefined
        ? { color: input.color?.trim() || null }
        : {}),
      ...(input.isFixedTime !== undefined
        ? { isFixedTime: input.isFixedTime }
        : {}),
      ...(input.comments !== undefined
        ? { comments: input.comments?.trim() || null }
        : {}),
      ...(input.noteId !== undefined
        ? { noteId: input.noteId?.trim() || null }
        : {}),
      startTime: normalized.start,
      endTime: normalized.end,
    },
    select: { id: true, updatedAt: true },
  });
  timeBlocksChanged([updated.id]);
  return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
}

/** One value per (day, key, contributor): sets it, creating it if needed. */
export async function setDayMeta(payload: z.input<typeof setDayMetaInput>) {
  const input = setDayMetaInput.parse(payload);
  const date = parseIsoDate(input.dateIso, "dateIso");
  const key = input.key.trim();
  const contributor = input.contributor.trim() || "default";
  const fields = {
    value: input.value,
    comments: input.comments?.trim() || null,
    noteId: input.noteId?.trim() || null,
  };
  const row = await prisma.timeBlockDayMetadata.upsert({
    where: { date_key_contributor: { date, key, contributor } },
    update: fields,
    create: { date, key, contributor, ...fields },
    select: { id: true },
  });
  timeBlocksChanged([row.id]);
  return row;
}

export async function updateDayMeta(
  payload: z.input<typeof updateDayMetaInput>,
) {
  const input = updateDayMetaInput.parse(payload);
  const row = await prisma.timeBlockDayMetadata.update({
    where: { id: input.id },
    data: {
      value: input.value,
      ...(input.comments !== undefined
        ? { comments: input.comments?.trim() || null }
        : {}),
      ...(input.noteId !== undefined
        ? { noteId: input.noteId?.trim() || null }
        : {}),
    },
    select: { id: true, updatedAt: true },
  });
  timeBlocksChanged([row.id]);
  return row;
}
