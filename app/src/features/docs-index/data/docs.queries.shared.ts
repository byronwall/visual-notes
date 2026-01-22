function toIsoDateStart(dateOnly: string): string {
  const d = new Date(dateOnly + "T00:00:00");
  return d.toISOString();
}

function toIsoDateEnd(dateOnly: string): string {
  const d = new Date(dateOnly + "T23:59:59.999");
  return d.toISOString();
}

function buildDocsWhere(q: {
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
}) {
  const where: Record<string, any> = {};
  if (q.pathPrefix) where.path = { startsWith: q.pathPrefix };
  if (q.pathBlankOnly) where.path = null;
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
  if (q.updatedFrom || q.updatedTo) {
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
  return where;
}

export { buildDocsWhere, toIsoDateEnd, toIsoDateStart };
