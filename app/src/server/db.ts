import { PrismaClient } from "@prisma/client";
import { serverEnv } from "~/env/server";
import { noteChangeExtension } from "./note-change-extension";

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
export const prisma = baseClient.$extends(noteChangeExtension);

/** The `tx` client handed to interactive `prisma.$transaction` callbacks. */
export type DbTransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
