import { z } from "zod";
import { logActionEvent } from "~/server/events/action-events";
import * as store from "~/server/time-blocks/time-block-store";
import type {
  TimeBlockDayMetadataItem,
  TimeBlockItem,
} from "~/services/time-blocks/time-blocks.types";
import {
  agentContext,
  appLink,
  ConnectorError,
  DAY_PATTERN,
  dayArg as plainDayArg,
  noteIdArg,
  noteRef,
  nothingWritten,
  requireNotes,
} from "./shared";
import type { ToolRegistrar } from "./tool-registry";

// The time-blocks calendar over the connector: blocks of planned time and
// per-day values (sleep, mood, …). Agents can plan and adjust; deleting
// blocks or day values stays with the user, as does the calendar layout.
//
// Day values and bare dates use the server's time zone, the same midnight the
// calendar stores, so a value set for 2026-10-21 shows on that day.

export const TIME_BLOCK_INSTRUCTIONS =
  "The time-blocks calendar plans the user's days. time_blocks_query returns blocks, per-day values, and the calendar's time zone; write times as ISO 8601 with that zone's offset. time_blocks_create / time_blocks_update plan or move blocks (noteId links a note), and time_blocks_set_day_value records a value for a day, such as sleep.";

const dayArg = plainDayArg.describe("YYYY-MM-DD in the calendar's time zone");
const whenArg = z
  .string()
  .min(1)
  .describe("ISO 8601 date-time, e.g. 2026-10-21T09:00:00-05:00");

const calendarTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Midnight of a YYYY-MM-DD day in the server's time zone. */
const startOfDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseWhen = (value: string, label: string) => {
  const date = DAY_PATTERN.test(value) ? startOfDay(value) : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new ConnectorError(
      "invalid",
      `${label} is not a date-time: ${value}`,
    );
  return date;
};

export function registerTimeBlockTools(tools: ToolRegistrar): void {
  const { ctx } = tools;
  const log = (
    eventType: string,
    entityId: string,
    payload: Record<string, string | string[]>,
  ) =>
    logActionEvent({
      eventType,
      entityType: eventType.startsWith("time_block_day")
        ? "time_block_day"
        : "time_block",
      entityId,
      payload,
      context: agentContext(ctx),
    });

  const blockView = (block: TimeBlockItem) => ({
    id: block.id,
    title: block.title,
    start: block.startTime,
    end: block.endTime,
    day: dayOf(new Date(block.startTime)),
    isFixedTime: block.isFixedTime,
    color: block.color,
    comments: block.comments,
    note: noteRef(ctx, block.noteId, block.noteTitle),
  });
  const dayValueView = (entry: TimeBlockDayMetadataItem) => ({
    id: entry.id,
    day: dayOf(new Date(entry.date)),
    key: entry.key,
    value: entry.value,
    contributor: entry.contributor,
    comments: entry.comments,
    note: noteRef(ctx, entry.noteId, entry.noteTitle),
  });

  tools.read(
    "time_blocks_query",
    {
      title: "Query time blocks",
      description:
        "Time blocks starting in a date range (both days included; defaults to the next 7 days) and the per-day values in it. Also returns the calendar's time zone.",
      input: {
        from: dayArg.optional(),
        to: dayArg.optional(),
        noteId: noteIdArg
          .optional()
          .describe("Only blocks linked to this note"),
      },
    },
    async ({ from, to, noteId }) => {
      const start = from ? startOfDay(from) : startOfDay(dayOf(new Date()));
      const last = to
        ? startOfDay(to)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      if (last < start)
        throw new ConnectorError("invalid", "to is before from");
      const end = new Date(
        last.getFullYear(),
        last.getMonth(),
        last.getDate() + 1,
      );
      const [blocks, dayValues] = await Promise.all([
        store.listTimeBlocks(start, end, noteId),
        store.listDayMeta(start, new Date(end.getTime() - 1)),
      ]);
      return {
        timeZone: calendarTimeZone(),
        from: dayOf(start),
        to: dayOf(last),
        appUrl: appLink(ctx, "/time-blocks"),
        blocks: blocks.map(blockView),
        dayValues: dayValues.map(dayValueView),
      };
    },
  );

  tools.write(
    "time_blocks_create",
    {
      title: "Create time block",
      description:
        "Plan a block of time on the calendar, optionally linked to a note.",
      input: {
        title: z.string().min(1).max(200),
        start: whenArg,
        end: whenArg,
        isFixedTime: z
          .boolean()
          .optional()
          .describe("A fixed appointment rather than flexible work"),
        color: z.string().max(64).optional().describe("CSS color"),
        comments: z.string().max(4000).optional(),
        noteId: z.string().optional(),
      },
    },
    async (args) => {
      const start = parseWhen(args.start, "start");
      const end = parseWhen(args.end, "end");
      if (end <= start)
        throw new ConnectorError("invalid", "end must be after start");
      await requireNotes([args.noteId]);
      const created = await store.createTimeBlock({
        title: args.title,
        startTimeIso: start.toISOString(),
        endTimeIso: end.toISOString(),
        isFixedTime: args.isFixedTime,
        color: args.color,
        comments: args.comments,
        noteId: args.noteId,
      });
      await log("time_block.created", created.id, {
        title: args.title,
        day: dayOf(start),
      });
      const [block] = await store.getTimeBlocks([created.id]);
      return blockView(block!);
    },
  );

  tools.write(
    "time_blocks_update",
    {
      title: "Update time blocks",
      description:
        "Move, resize, rename, or relink up to 50 blocks. Fields you leave out stay as they are; pass null to clear color, comments, or noteId.",
      input: {
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().min(1).max(200).optional(),
              start: whenArg.optional(),
              end: whenArg.optional(),
              isFixedTime: z.boolean().optional(),
              color: z.string().max(64).nullable().optional(),
              comments: z.string().max(4000).nullable().optional(),
              noteId: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      },
      idempotent: true,
    },
    async ({ updates }) => {
      const ids = updates.map((u) => u.id);
      const existing = new Map(
        (await store.getTimeBlocks(ids)).map((b) => [b.id, b]),
      );
      const problems: string[] = [];
      const planned = updates.map((u) => {
        const block = existing.get(u.id);
        if (!block) {
          problems.push(`no time block "${u.id}"`);
          return null;
        }
        const start = u.start
          ? parseWhen(u.start, "start")
          : new Date(block.startTime);
        const end = u.end ? parseWhen(u.end, "end") : new Date(block.endTime);
        if (end <= start)
          problems.push(`block "${u.id}" would end before it starts`);
        return { ...u, start, end, block };
      });
      await requireNotes(updates.map((u) => u.noteId));
      if (problems.length) {
        throw new ConnectorError("invalid", nothingWritten(problems));
      }
      for (const plan of planned) {
        const { id, start, end, block, ...fields } = plan!;
        await store.updateTimeBlock({
          id,
          title: fields.title,
          isFixedTime: fields.isFixedTime,
          color: fields.color,
          comments: fields.comments,
          noteId: fields.noteId,
          startTimeIso: start.toISOString(),
          endTimeIso: end.toISOString(),
        });
        await log("time_block.updated", id, {
          title: fields.title ?? block.title ?? "",
          day: dayOf(start),
          fieldsChanged: Object.keys(updates.find((u) => u.id === id)!).filter(
            (key) => key !== "id",
          ),
        });
      }
      return { blocks: (await store.getTimeBlocks(ids)).map(blockView) };
    },
  );

  tools.write(
    "time_blocks_set_day_value",
    {
      title: "Set day value",
      description:
        "Record a value for a day and key (one per day, key, and contributor), e.g. key 'sleep' value '7.5h'. Replaces the value if one is already set.",
      input: {
        day: dayArg,
        key: z.string().min(1).max(128),
        value: z.string().min(1).max(4000),
        contributor: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe("Who the value is about or from; defaults to 'default'"),
        comments: z.string().max(4000).optional(),
        noteId: z.string().optional(),
      },
      idempotent: true,
    },
    async (args) => {
      await requireNotes([args.noteId]);
      const date = startOfDay(args.day);
      const row = await store.setDayMeta({
        dateIso: date.toISOString(),
        key: args.key,
        value: args.value,
        contributor: args.contributor,
        comments: args.comments,
        noteId: args.noteId,
      });
      await log("time_block_day.set", row.id, {
        key: args.key.trim(),
        day: args.day,
      });
      const saved = (await store.listDayMeta(date, date)).find(
        (entry) => entry.id === row.id,
      );
      return dayValueView(saved!);
    },
  );
}
