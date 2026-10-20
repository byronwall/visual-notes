import { Prisma } from "@prisma/client";
import type { NoteChange } from "~/lib/note-events";
import { publishNoteChanges } from "./note-events";

type Publish = (changes: NoteChange[] | null) => void;

const SINGLE_WRITES = new Set(["create", "update", "upsert", "delete"]);
const RETURNING_WRITES = new Set([
  "createManyAndReturn",
  "updateManyAndReturn",
]);
const BULK_WRITES = new Set(["createMany", "updateMany", "deleteMany"]);

const toIso = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : undefined;
};

const changeFrom = (
  row: unknown,
  fallbackId: unknown,
  deleted: boolean,
): NoteChange | null => {
  const record = (row ?? {}) as { id?: unknown; updatedAt?: unknown };
  const id = typeof record.id === "string" ? record.id : fallbackId;
  if (typeof id !== "string") return null;
  const change: NoteChange = { id };
  const updatedAt = toIso(record.updatedAt);
  if (updatedAt && !deleted) change.updatedAt = updatedAt;
  if (deleted) change.deleted = true;
  return change;
};

/**
 * Turns one Doc write into the changes to publish. Returns `undefined` for
 * reads. Writes whose ids are unknown publish `null` ("refresh everything").
 */
export function noteChangesFor(
  operation: string,
  args: unknown,
  result: unknown,
): NoteChange[] | null | undefined {
  if (BULK_WRITES.has(operation)) {
    const count = (result as { count?: unknown } | null)?.count;
    return count === 0 ? [] : null;
  }
  if (RETURNING_WRITES.has(operation)) {
    if (!Array.isArray(result)) return null;
    const changes = result.map((row) => changeFrom(row, undefined, false));
    return changes.some((c) => c === null) ? null : (changes as NoteChange[]);
  }
  if (!SINGLE_WRITES.has(operation)) return undefined;
  const whereId = (args as { where?: { id?: unknown } } | null)?.where?.id;
  const change = changeFrom(result, whereId, operation === "delete");
  return change ? [change] : null;
}

export const createNoteChangeExtension = (publish: Publish) =>
  Prisma.defineExtension({
    name: "note-change-events",
    query: {
      doc: {
        async $allOperations({ operation, args, query }) {
          const result = await query(args);
          const changes = noteChangesFor(operation, args, result);
          if (changes !== undefined) {
            try {
              publish(changes);
            } catch (err) {
              console.error("[note-events] publish failed", err);
            }
          }
          return result;
        },
      },
    },
  });

/** Publishes a notes:changed event after every successful Doc write. */
export const noteChangeExtension =
  createNoteChangeExtension(publishNoteChanges);
