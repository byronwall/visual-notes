import { prisma } from "../src/server/db";
import { backfillSearchText } from "../src/server/notes/search-text";

try {
  await backfillSearchText();
} catch (error) {
  console.error("[search-text] backfill failed", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
