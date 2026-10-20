import { PrismaClient } from "@prisma/client";
import { serverEnv } from "~/env/server";
import { deferNoteChanges, noteChangeExtension } from "./note-change-extension";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const baseClient =
  global.prisma ||
  new PrismaClient({
    log:
      serverEnv.NODE_ENV === "development"
        ? ["info", "error", "warn"]
        : ["error"],
  });

if (serverEnv.NODE_ENV !== "production") {
  global.prisma = baseClient;
}

// Every Doc write publishes a notes:changed signal so open tabs refresh.
// Writes inside `$transaction` publish once it commits.
const extended = baseClient.$extends(noteChangeExtension);
const runTransaction = extended.$transaction.bind(extended) as (
  ...args: unknown[]
) => Promise<unknown>;

// The cast keeps `PrismaClient` and `Prisma.TransactionClient` types for
// callers: a query-only extension changes no model or result types.
export const prisma = new Proxy(extended, {
  get(target, prop) {
    if (prop === "$transaction") {
      return (...args: unknown[]) =>
        deferNoteChanges(() => runTransaction(...args));
    }
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as unknown as PrismaClient;
