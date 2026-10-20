import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { searchableText } from "./note-store";

/** Fill pre-existing notes once, before the server accepts search requests. */
export async function backfillSearchText() {
  let count = 0;
  for (;;) {
    const docs = await prisma.doc.findMany({
      where: { searchText: null },
      orderBy: { id: "asc" },
      take: 100,
      select: {
        id: true,
        updatedAt: true,
        content: true,
        html: true,
        markdown: true,
      },
    });
    if (!docs.length) break;
    const values = docs.map((doc) =>
      Prisma.sql`(${doc.id}, ${doc.updatedAt}, ${searchableText(doc)})`,
    );
    // Preserve edit dates and never overwrite a concurrent content save.
    count += await prisma.$executeRaw`
      UPDATE "Doc" AS d SET "searchText" = batch.text
      FROM (VALUES ${Prisma.join(values)}) AS batch(id, updated, text)
      WHERE d.id = batch.id AND d."updatedAt" = batch.updated::timestamp
        AND d."searchText" IS NULL`;
  }
  if (count) {
    await prisma.$executeRaw`VACUUM (ANALYZE) "Doc"`;
    console.info("[search-text] indexed %d existing notes", count);
  }
  return count;
}
