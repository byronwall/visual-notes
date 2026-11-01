import type { DocsFilters } from "./docs.types";

function toIsoDate(dateOnly: string, time: string): string | undefined {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!parts) return undefined;

  const d = new Date(`${dateOnly}T${time}`);
  if (
    !Number.isFinite(d.getTime()) ||
    d.getFullYear() !== Number(parts[1]) ||
    d.getMonth() !== Number(parts[2]) - 1 ||
    d.getDate() !== Number(parts[3])
  ) {
    return undefined;
  }

  return d.toISOString();
}

function toIsoDateStart(dateOnly: string): string | undefined {
  return toIsoDate(dateOnly, "00:00:00");
}

function toIsoDateEnd(dateOnly: string): string | undefined {
  return toIsoDate(dateOnly, "23:59:59.999");
}

function buildDocsWhere(q: DocsFilters) {
  // Archived notes only show on the archive page.
  const where: Record<string, any> = { archivedAt: null };
  const andClauses: Record<string, unknown>[] = [];
  if (q.pathPrefix && !q.pathBlankOnly) {
    andClauses.push({
      OR: [
        { path: q.pathPrefix },
        { path: { startsWith: `${q.pathPrefix}.` } },
      ],
    });
  }
  if (q.pathBlankOnly) {
    andClauses.push({
      OR: [{ path: null }, { path: "" }],
    });
  }
  if (q.metaKey && q.metaValue !== undefined) {
    where.meta = { path: [q.metaKey], equals: q.metaValue } as any;
  } else if (q.metaKey && q.metaValue === undefined) {
    where.meta = { path: [q.metaKey], not: null } as any;
  }
  if (q.source) where.originalSource = q.source;
  if (q.originalContentId) {
    where.originalContentId = {
      contains: q.originalContentId,
      mode: "insensitive",
    } as any;
  }
  if (q.createdFrom || q.createdTo) {
    const range: any = {};
    if (q.createdFrom) {
      const d = new Date(q.createdFrom);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (q.createdTo) {
      const d = new Date(q.createdTo);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length) where.createdAt = range;
  }
  if (q.updatedWithinDays) {
    where.updatedAt = {
      gte: new Date(Date.now() - q.updatedWithinDays * 24 * 60 * 60 * 1000),
    };
  } else if (q.updatedFrom || q.updatedTo) {
    const range: any = {};
    if (q.updatedFrom) {
      const d = new Date(q.updatedFrom);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (q.updatedTo) {
      const d = new Date(q.updatedTo);
      if (!isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length) where.updatedAt = range;
  }
  if (q.activityClass) {
    where.activitySnapshot = { activityClass: q.activityClass };
  }
  if (q.collectionId) {
    where.collectionId = q.collectionId;
  } else if (q.collectionRows === "only") {
    where.collectionId = { not: null };
  } else if (q.collectionRows !== "all") {
    andClauses.push({
      OR: [{ collectionId: null }, { collection: { showRowsInRecent: true } }],
    });
  }
  if (andClauses.length > 0) {
    where.AND = andClauses;
  }
  return where;
}

/** `buildDocsWhere` for URL filters, whose date bounds are date-only strings. */
function docsWhereFromFilters(q: DocsFilters) {
  return buildDocsWhere({
    ...q,
    createdFrom: q.createdFrom ? toIsoDateStart(q.createdFrom) : undefined,
    createdTo: q.createdTo ? toIsoDateEnd(q.createdTo) : undefined,
    updatedFrom: q.updatedFrom ? toIsoDateStart(q.updatedFrom) : undefined,
    updatedTo: q.updatedTo ? toIsoDateEnd(q.updatedTo) : undefined,
  });
}

export { buildDocsWhere, docsWhereFromFilters, toIsoDateEnd, toIsoDateStart };
