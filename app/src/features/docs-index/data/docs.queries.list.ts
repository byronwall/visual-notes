import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { DocListItem } from "./docs.types";
import {
  buildDocsWhere,
  toIsoDateEnd,
  toIsoDateStart,
} from "./docs.queries.shared";

export const fetchDocs = query(
  async (q: {
    pathPrefix?: string;
    pathBlankOnly?: boolean;
    metaKey?: string;
    metaValue?: string;
    source?: string;
    originalContentId?: string;
    createdFrom?: string;
    createdTo?: string;
    updatedFrom?: string;
    updatedTo?: string;
    take?: number;
  }): Promise<DocListItem[]> => {
    "use server";
    const where = buildDocsWhere({
      pathPrefix: q.pathPrefix,
      pathBlankOnly: q.pathBlankOnly,
      metaKey: q.metaKey,
      metaValue: q.metaValue,
      source: q.source,
      originalContentId: q.originalContentId,
      createdFrom: q.createdFrom ? toIsoDateStart(q.createdFrom) : undefined,
      createdTo: q.createdTo ? toIsoDateEnd(q.createdTo) : undefined,
      updatedFrom: q.updatedFrom ? toIsoDateStart(q.updatedFrom) : undefined,
      updatedTo: q.updatedTo ? toIsoDateEnd(q.updatedTo) : undefined,
    });
    const take = Math.max(1, Math.min(8000, q.take ?? 8000));
    const items = await prisma.doc.findMany({
      orderBy: { updatedAt: "desc" },
      where,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        path: true,
        meta: true,
      },
      take,
    });
    try {
      console.log(
        `[docs.list] filters pathPrefix=${q.pathPrefix || ""} pathBlankOnly=${
          q.pathBlankOnly ? "1" : ""
        } metaKey=${q.metaKey || ""} source=${q.source || ""}`
      );
    } catch {}
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      path: item.path,
      meta: item.meta as DocListItem["meta"],
    }));
  },
  "docs-index-list"
);

export const fetchDocsServerNow = query(async (): Promise<number> => {
  "use server";
  return Date.now();
}, "docs-index-server-now");
