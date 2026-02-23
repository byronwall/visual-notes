import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type {
  TimeBlockCounts,
  TimeBlockDayMetadataItem,
  TimeBlockItem,
  TimeBlockMetadataSummaryRow,
} from "./time-blocks.types";

type WeeklyBlocksInput = {
  weekStartIso: string;
  numberOfDays?: number;
  noteId?: string;
};

type RangeInput = {
  startIso: string;
  endIso: string;
  noteId?: string;
};

const parseIsoDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`);
  }
  return date;
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const mapTimeBlock = (
  row: {
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
  }
): TimeBlockItem => ({
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

const mapMetadata = (
  row: {
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
  }
): TimeBlockDayMetadataItem => ({
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

export const fetchTimeBlocksForRange = query(
  async (input: RangeInput): Promise<TimeBlockItem[]> => {
    "use server";
    const start = parseIsoDate(String(input?.startIso || ""), "startIso");
    const end = parseIsoDate(String(input?.endIso || ""), "endIso");
    const noteId = String(input?.noteId || "").trim();
    const rows = await prisma.timeBlock.findMany({
      where: {
        startTime: {
          gte: start,
          lt: end,
        },
        ...(noteId ? { noteId } : {}),
      },
      include: {
        note: { select: { title: true } },
      },
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
    });
    return rows.map(mapTimeBlock);
  },
  "time-blocks-range"
);

export const fetchWeeklyTimeBlocks = query(
  async (input: WeeklyBlocksInput): Promise<TimeBlockItem[]> => {
    "use server";
    const weekStart = parseIsoDate(
      String(input?.weekStartIso || ""),
      "weekStartIso"
    );
    const numberOfDays = Math.max(1, Math.min(31, input?.numberOfDays ?? 7));
    const weekEnd = addDays(weekStart, numberOfDays);
    const noteId = String(input?.noteId || "").trim();
    const rows = await prisma.timeBlock.findMany({
      where: {
        startTime: {
          gte: weekStart,
          lt: weekEnd,
        },
        ...(noteId ? { noteId } : {}),
      },
      include: {
        note: { select: { title: true } },
      },
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
    });
    return rows.map(mapTimeBlock);
  },
  "time-blocks-weekly"
);

export const fetchTimeBlockById = query(
  async (id: string): Promise<TimeBlockItem | null> => {
    "use server";
    const blockId = String(id || "").trim();
    if (!blockId) return null;
    const row = await prisma.timeBlock.findUnique({
      where: { id: blockId },
      include: {
        note: { select: { title: true } },
      },
    });
    return row ? mapTimeBlock(row) : null;
  },
  "time-block-by-id"
);

export const fetchTimeBlockCounts = query(async (): Promise<TimeBlockCounts> => {
  "use server";
  const today = startOfDay(new Date());
  const todayEnd = endOfDay(today);
  const nextWeekEnd = endOfDay(addDays(today, 7));
  const [todayCount, upcomingCount] = await Promise.all([
    prisma.timeBlock.count({
      where: {
        startTime: {
          gte: today,
          lte: todayEnd,
        },
      },
    }),
    prisma.timeBlock.count({
      where: {
        startTime: {
          gt: todayEnd,
          lte: nextWeekEnd,
        },
      },
    }),
  ]);

  return {
    today: todayCount,
    upcoming: upcomingCount,
  };
}, "time-block-counts");

export const fetchTimeBlockBacklinks = query(
  async (input: { noteId: string; take?: number }): Promise<TimeBlockItem[]> => {
    "use server";
    const noteId = String(input?.noteId || "").trim();
    if (!noteId) return [];
    const take = Math.max(1, Math.min(100, input?.take ?? 20));
    const rows = await prisma.timeBlock.findMany({
      where: {
        noteId,
      },
      include: {
        note: { select: { title: true } },
      },
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
      take,
    });
    return rows.map(mapTimeBlock);
  },
  "time-block-backlinks"
);

export const fetchTimeBlockDayMeta = query(
  async (input: { dateIso: string }): Promise<TimeBlockDayMetadataItem[]> => {
    "use server";
    const date = parseIsoDate(String(input?.dateIso || ""), "dateIso");
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const rows = await prisma.timeBlockDayMetadata.findMany({
      where: {
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        note: { select: { title: true } },
      },
      orderBy: [{ key: "asc" }, { contributor: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(mapMetadata);
  },
  "time-block-day-meta"
);

export const fetchDateRangeTimeBlockMeta = query(
  async (input: {
    startIso: string;
    endIso: string;
  }): Promise<TimeBlockDayMetadataItem[]> => {
    "use server";
    const start = parseIsoDate(String(input?.startIso || ""), "startIso");
    const end = parseIsoDate(String(input?.endIso || ""), "endIso");
    const rows = await prisma.timeBlockDayMetadata.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        note: { select: { title: true } },
      },
      orderBy: [{ date: "asc" }, { key: "asc" }, { contributor: "asc" }],
    });
    return rows.map(mapMetadata);
  },
  "time-block-meta-range"
);

export const fetchDateRangeTimeBlockMetaSummary = query(
  async (input: {
    startIso: string;
    endIso: string;
  }): Promise<{
    keys: string[];
    rows: TimeBlockMetadataSummaryRow[];
  }> => {
    "use server";
    const entries = await fetchDateRangeTimeBlockMeta({
      startIso: input.startIso,
      endIso: input.endIso,
    });
    const keys = Array.from(new Set(entries.map((entry) => entry.key))).sort();
    const byDate = new Map<string, TimeBlockMetadataSummaryRow>();
    for (const entry of entries) {
      const dateKey = startOfDay(new Date(entry.date)).toISOString();
      const row = byDate.get(dateKey) ?? { date: dateKey, values: {} };
      row.values[`${entry.key}:${entry.contributor}`] = {
        id: entry.id,
        value: entry.value,
        contributor: entry.contributor,
        comments: entry.comments,
        noteId: entry.noteId,
        noteTitle: entry.noteTitle,
      };
      byDate.set(dateKey, row);
    }
    return {
      keys,
      rows: Array.from(byDate.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };
  },
  "time-block-meta-summary"
);
