import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import type { EditEffects, StreamEdit } from "./research.edits";
import {
  lintWrite,
  ResearchIngestError,
  type IngestResult,
} from "./research.ingest";
import { kindsSchema, parseKinds } from "./research.kinds";
import { formatPayloadError } from "./research.payload";
import { MAX_STREAMS } from "./research.types";

// A topic's frame: its streams, declared kinds, and current answer. Changing
// the frame is a batch like any card write, so it shows in history and undo.

const streamKey = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "use lowercase letters, digits, - or _");

export const streamInputSchema = z.object({
  key: streamKey,
  title: z.string().trim().min(1).max(120).optional(),
  goal: z.string().trim().max(600).optional(),
  answer: z.string().max(20_000).optional(),
  /** Column position; new streams go after existing ones by default. */
  order: z.number().int().min(0).max(1000).optional(),
});

export const topicSetupSchema = z.object({
  batchKey: z.string().trim().min(1).max(200),
  agent: z.string().trim().min(1).max(100),
  /** Upserted by key; streams you leave out stay as they are. */
  streams: z.array(streamInputSchema).max(MAX_STREAMS).optional(),
  removeStreams: z.array(streamKey).max(MAX_STREAMS).optional(),
  /** Replaces the whole kind list. */
  kinds: kindsSchema.optional(),
  answer: z.string().max(20_000).optional(),
});

export type TopicSetupInput = z.input<typeof topicSetupSchema>;

const plural = (count: number, one: string) =>
  `${count} ${one}${count === 1 ? "" : "s"}`;

export const setupTopic = async (
  topicId: string,
  raw: TopicSetupInput,
): Promise<IngestResult> => {
  const parsed = topicSetupSchema.safeParse(raw);
  if (!parsed.success)
    throw new ResearchIngestError(formatPayloadError(parsed.error));
  const input = parsed.data;
  if (
    !input.streams?.length &&
    !input.removeStreams?.length &&
    !input.kinds &&
    input.answer === undefined
  ) {
    throw new ResearchIngestError([
      "pass streams, removeStreams, kinds, or answer",
    ]);
  }
  const existing = await prisma.researchBatch.findUnique({
    where: { topicId_batchKey: { topicId, batchKey: input.batchKey } },
  });
  const counts = { refs: {}, cardCount: 0, linkCount: 0, summaryCount: 0 };
  if (existing)
    return {
      batchId: existing.id,
      batchKey: input.batchKey,
      replayed: true,
      ...counts,
    };

  const result = await prisma.$transaction(async (tx) => {
    const topic = await tx.researchTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new ResearchIngestError([`topic "${topicId}" not found`]);
    const streams = await tx.researchStream.findMany({ where: { topicId } });
    const visible = streams.filter((stream) => !stream.hiddenAt);
    const byKey = new Map(streams.map((stream) => [stream.key, stream]));
    const issues: string[] = [];
    const batchId = randomUUID();
    const effects: EditEffects = { topicId };
    const parts: string[] = [];

    const removing = new Set(input.removeStreams ?? []);
    for (const key of removing) {
      const stream = byKey.get(key);
      if (!stream || stream.hiddenAt)
        issues.push(`removeStreams: no stream "${key}"`);
    }
    const added = (input.streams ?? []).filter((entry) => {
      const stream = byKey.get(entry.key);
      return !stream || stream.hiddenAt;
    });
    const remaining = visible.filter(
      (stream) => !removing.has(stream.key),
    ).length;
    if (remaining + added.length > MAX_STREAMS) {
      issues.push(
        `a topic holds at most ${MAX_STREAMS} streams (would have ${remaining + added.length})`,
      );
    }
    for (const entry of added)
      if (!entry.title)
        issues.push(`streams: new stream "${entry.key}" needs a title`);

    if (input.kinds) {
      const keep = new Set(input.kinds.map((kind) => kind.key));
      const dropped = parseKinds(topic.kinds).filter(
        (kind) => !keep.has(kind.key),
      );
      if (dropped.length) {
        const inUse = await tx.researchCard.findMany({
          where: {
            topicId,
            hiddenAt: null,
            kind: { in: dropped.map((kind) => kind.key) },
          },
          select: { id: true, kind: true },
          take: 5,
        });
        for (const card of inUse)
          issues.push(
            `kinds: "${card.kind}" is still used by card "${card.id}"; change that card first`,
          );
      }
    }
    if (issues.length) throw new ResearchIngestError(issues);

    await tx.researchBatch.create({
      data: {
        id: batchId,
        topicId,
        batchKey: input.batchKey,
        agent: input.agent,
        summary: "",
      },
    });

    let nextOrder = visible.reduce(
      (max, stream) => Math.max(max, stream.sortOrder + 1),
      0,
    );
    const streamEdits: StreamEdit[] = [];
    for (const entry of input.streams ?? []) {
      const stream = byKey.get(entry.key);
      if (!stream) {
        await tx.researchStream.create({
          data: {
            topicId,
            batchId,
            key: entry.key,
            title: entry.title!,
            goal: entry.goal ?? "",
            answer: entry.answer ?? "",
            sortOrder: entry.order ?? nextOrder++,
          },
        });
        continue;
      }
      // A stream removed earlier comes back as an edit plus an un-hide.
      const after = {
        ...(entry.title === undefined ? {} : { title: entry.title }),
        ...(entry.goal === undefined ? {} : { goal: entry.goal }),
        ...(entry.answer === undefined ? {} : { answer: entry.answer }),
        ...(entry.order === undefined ? {} : { sortOrder: entry.order }),
      };
      const current = stream as unknown as Record<string, unknown>;
      const changed = Object.entries(after).filter(
        ([key, value]) => current[key] !== value,
      );
      if (changed.length) {
        const edit = {
          id: stream.id,
          before: Object.fromEntries(
            changed.map(([key]) => [key, current[key]]),
          ),
          after: Object.fromEntries(changed),
        };
        streamEdits.push(edit);
        await tx.researchStream.update({
          where: { id: stream.id },
          data: edit.after,
        });
      }
      if (stream.hiddenAt) {
        await tx.researchStream.update({
          where: { id: stream.id },
          data: { hiddenAt: null },
        });
        effects.restoredStreamIds = [
          ...(effects.restoredStreamIds ?? []),
          stream.id,
        ];
      }
    }
    if (added.length) parts.push(`added ${plural(added.length, "stream")}`);
    if (streamEdits.length) {
      effects.streamEdits = streamEdits;
      const answered = streamEdits.filter(
        (edit) => "answer" in edit.after,
      ).length;
      parts.push(
        answered
          ? `updated ${plural(answered, "stream answer")}`
          : `edited ${plural(streamEdits.length, "stream")}`,
      );
    }
    if (removing.size) {
      const ids = visible
        .filter((stream) => removing.has(stream.key))
        .map((stream) => stream.id);
      await tx.researchStream.updateMany({
        where: { id: { in: ids } },
        data: { hiddenAt: new Date() },
      });
      effects.removedStreamIds = ids;
      parts.push(`removed ${plural(ids.length, "stream")}`);
    }

    const topicAfter: { answer?: string; kinds?: unknown } = {};
    if (input.answer !== undefined && input.answer !== topic.answer)
      topicAfter.answer = input.answer;
    if (
      input.kinds &&
      JSON.stringify(input.kinds) !== JSON.stringify(topic.kinds)
    )
      topicAfter.kinds = input.kinds;
    if (Object.keys(topicAfter).length) {
      effects.topicEdit = {
        before: Object.fromEntries(
          Object.keys(topicAfter).map((key) => [
            key,
            topic[key as "answer" | "kinds"],
          ]),
        ),
        after: topicAfter,
      };
      if (topicAfter.answer !== undefined)
        parts.push("updated the topic answer");
      if (topicAfter.kinds)
        parts.push(
          `set ${plural((topicAfter.kinds as unknown[]).length, "kind")}`,
        );
    }
    await tx.researchTopic.update({
      where: { id: topicId },
      data: {
        updatedAt: new Date(),
        ...(topicAfter.answer === undefined
          ? {}
          : { answer: topicAfter.answer }),
        ...(topicAfter.kinds
          ? { kinds: topicAfter.kinds as Prisma.InputJsonValue }
          : {}),
      },
    });
    const summary = parts.length
      ? `${parts[0][0].toUpperCase()}${parts.join(", ").slice(1)}`
      : "No changes";
    await tx.researchBatch.update({
      where: { id: batchId },
      data: {
        summary,
        result: { ...counts, ...effects } as unknown as Prisma.InputJsonValue,
      },
    });
    return { batchId, batchKey: input.batchKey, replayed: false, ...counts };
  });
  publishAppChange("research", [topicId]);
  // A new frame re-judges every card (e.g. which ones are now in no stream).
  return { ...result, warnings: await lintWrite(topicId, null) };
};
