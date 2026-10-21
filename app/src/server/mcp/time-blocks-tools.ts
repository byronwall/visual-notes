import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodError } from "zod";
import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import * as store from "~/server/time-blocks/time-block-store";
import type {
  TimeBlockDayMetadataItem,
  TimeBlockItem,
} from "~/services/time-blocks/time-blocks.types";
import { ConnectorError, noteUrl, type ConnectorContext } from "./notes-shared";

// The time-blocks calendar over the connector: blocks of planned time and
// per-day values (sleep, mood, …). Agents can plan and adjust; deleting
// blocks or day values stays with the user, as does the calendar layout.
//
// Day values and bare dates use the server's time zone, the same midnight the
// calendar stores, so a value set for 2026-10-21 shows on that day.

export const TIME_BLOCK_TOOL_SCOPES: Record<string, string> = {
  time_blocks_list: "notes:read",
  time_blocks_create: "notes:write",
  time_blocks_update: "notes:write",
  time_blocks_set_day_value: "notes:write",
};

export const TIME_BLOCK_INSTRUCTIONS =
  "The time-blocks calendar plans the user's days. time_blocks_list returns blocks and per-day values for a date range and the calendar's time zone; write times as ISO 8601 with that zone's offset. time_blocks_create/time_blocks_update plan or move blocks (link a note with noteId); time_blocks_set_day_value records a value for a day and key. Deleting stays with the user.";

type Guarded = (
  ctx: ConnectorContext,
  tool: string,
  fn: () => Promise<unknown>,
) => Promise<CallToolResult>;

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayArg = z
  .string()
  .regex(DAY, "use YYYY-MM-DD")
  .describe("YYYY-MM-DD in the calendar's time zone");
const whenArg = z
  .string()
  .min(1)
  .describe("ISO 8601 date-time, e.g. 2026-10-21T09:00:00-05:00");

export const calendarTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Midnight of a YYYY-MM-DD day in the server's time zone. */
const startOfDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dayOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseWhen = (value: string, label: string) => {
  const date = DAY.test(value) ? startOfDay(value) : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new ConnectorError(
      "invalid",
      `${label} is not a date-time: ${value}`,
    );
  return date;
};

const refusing = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConnectorError(
        "invalid",
        error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    }
    if (error instanceof store.TimeBlockInputError)
      throw new ConnectorError("invalid", error.message);
    throw error;
  }
};

async function assertNotes(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return;
  const found = await prisma.doc.findMany({
    where: { id: { in: wanted } },
    select: { id: true },
  });
  const missing = wanted.filter((id) => !found.some((doc) => doc.id === id));
  if (missing.length)
    throw new ConnectorError(
      "not_found",
      `Nothing was changed. No notes with ids: ${missing.join(", ")}`,
    );
}

export function registerTimeBlockTools(
  server: McpServer,
  ctx: ConnectorContext,
  guarded: Guarded,
): void {
  const context = { actorId: ctx.actorId, actorType: "chatgpt" as const };
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
      context,
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
    note: block.noteId
      ? {
          id: block.noteId,
          title: block.noteTitle,
          url: noteUrl(ctx, block.noteId),
        }
      : null,
  });
  const dayValueView = (entry: TimeBlockDayMetadataItem) => ({
    id: entry.id,
    day: dayOf(new Date(entry.date)),
    key: entry.key,
    value: entry.value,
    contributor: entry.contributor,
    comments: entry.comments,
    note: entry.noteId
      ? {
          id: entry.noteId,
          title: entry.noteTitle,
          url: noteUrl(ctx, entry.noteId),
        }
      : null,
  });

  server.registerTool(
    "time_blocks_list",
    {
      title: "List time blocks",
      description:
        "Time blocks starting in a date range (both days included; defaults to the next 7 days) and the per-day values in it. Also returns the calendar's time zone.",
      inputSchema: {
        from: dayArg.optional(),
        to: dayArg.optional(),
        noteId: z
          .string()
          .optional()
          .describe("Only blocks linked to this note"),
      },
      annotations: readOnly,
    },
    ({ from, to, noteId }) =>
      guarded(ctx, "time_blocks_list", async () => {
        const start = from ? startOfDay(from) : startOfDay(dayOf(new Date()));
        const last = to
          ? startOfDay(to)
          : new Date(
              start.getFullYear(),
              start.getMonth(),
              start.getDate() + 6,
            );
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
          url: `${ctx.origin}/time-blocks`,
          blocks: blocks.map(blockView),
          dayValues: dayValues.map(dayValueView),
        };
      }),
  );

  server.registerTool(
    "time_blocks_create",
    {
      title: "Create time block",
      description:
        "Plan a block of time on the calendar, optionally linked to a note.",
      inputSchema: {
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
      annotations: write,
    },
    (args) =>
      guarded(ctx, "time_blocks_create", async () => {
        const start = parseWhen(args.start, "start");
        const end = parseWhen(args.end, "end");
        if (end <= start)
          throw new ConnectorError("invalid", "end must be after start");
        await assertNotes([args.noteId]);
        const created = await refusing(() =>
          store.createTimeBlock({
            title: args.title,
            startTimeIso: start.toISOString(),
            endTimeIso: end.toISOString(),
            isFixedTime: args.isFixedTime,
            color: args.color,
            comments: args.comments,
            noteId: args.noteId,
          }),
        );
        await log("time_block.created", created.id, {
          title: args.title,
          day: dayOf(start),
        });
        const [block] = await store.getTimeBlocks([created.id]);
        return blockView(block);
      }),
  );

  server.registerTool(
    "time_blocks_update",
    {
      title: "Update time blocks",
      description:
        "Move, resize, rename, or relink up to 50 blocks. Fields you leave out stay as they are; pass null to clear color, comments, or noteId.",
      inputSchema: {
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
      annotations: { ...write, idempotentHint: true },
    },
    ({ updates }) =>
      guarded(ctx, "time_blocks_update", async () => {
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
        await assertNotes(updates.map((u) => u.noteId));
        if (problems.length) {
          throw new ConnectorError(
            "invalid",
            `Nothing was changed. Fix these and retry:\n${problems.map((p) => `- ${p}`).join("\n")}`,
          );
        }
        for (const plan of planned) {
          const { id, start, end, block, ...fields } = plan!;
          await refusing(() =>
            store.updateTimeBlock({
              id,
              title: fields.title,
              isFixedTime: fields.isFixedTime,
              color: fields.color,
              comments: fields.comments,
              noteId: fields.noteId,
              startTimeIso: start.toISOString(),
              endTimeIso: end.toISOString(),
            }),
          );
          await log("time_block.updated", id, {
            title: fields.title ?? block.title ?? "",
            day: dayOf(start),
            fieldsChanged: Object.keys(
              updates.find((u) => u.id === id)!,
            ).filter((key) => key !== "id"),
          });
        }
        return (await store.getTimeBlocks(ids)).map(blockView);
      }),
  );

  server.registerTool(
    "time_blocks_set_day_value",
    {
      title: "Set day value",
      description:
        "Record a value for a day and key (one per day, key, and contributor), e.g. key 'sleep' value '7.5h'. Replaces the value if one is already set.",
      inputSchema: {
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
      annotations: { ...write, idempotentHint: true },
    },
    (args) =>
      guarded(ctx, "time_blocks_set_day_value", async () => {
        await assertNotes([args.noteId]);
        const date = startOfDay(args.day);
        const row = await refusing(() =>
          store.setDayMeta({
            dateIso: date.toISOString(),
            key: args.key,
            value: args.value,
            contributor: args.contributor,
            comments: args.comments,
            noteId: args.noteId,
          }),
        );
        await log("time_block_day.set", row.id, {
          key: args.key.trim(),
          day: args.day,
        });
        const saved = (await store.listDayMeta(date, date)).find(
          (entry) => entry.id === row.id,
        );
        return dayValueView(saved!);
      }),
  );
}
