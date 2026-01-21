import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const pathPrefix = url.searchParams.get("pathPrefix") || undefined;
  const pathBlankOnlyParam = url.searchParams.get("pathBlankOnly") || undefined;
  const metaKey = url.searchParams.get("metaKey") || undefined;
  const metaValueRaw = url.searchParams.get("metaValue");
  const metaValue = metaValueRaw ?? undefined;
  const source = url.searchParams.get("source") || undefined;
  const originalContentId =
    url.searchParams.get("originalContentId") || undefined;
  const createdFromParam = url.searchParams.get("createdFrom") || undefined;
  const createdToParam = url.searchParams.get("createdTo") || undefined;
  const updatedFromParam = url.searchParams.get("updatedFrom") || undefined;
  const updatedToParam = url.searchParams.get("updatedTo") || undefined;
  const take = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("take") || "50"))
  );

  if (!q) return json({ items: [] });

  const docFilters: Record<string, unknown> = {};
  if (
    pathPrefix ||
    pathBlankOnlyParam ||
    metaKey ||
    source ||
    createdFromParam ||
    createdToParam ||
    updatedFromParam ||
    updatedToParam
  ) {
    if (pathPrefix) docFilters.path = { startsWith: pathPrefix };
    if (
      pathBlankOnlyParam &&
      (pathBlankOnlyParam === "1" ||
        pathBlankOnlyParam.toLowerCase() === "true")
    ) {
      docFilters.path = null;
    }
    if (metaKey && metaValue !== undefined) {
      docFilters.meta = { path: [metaKey], equals: metaValue } as any;
    } else if (metaKey && metaValue === undefined) {
      docFilters.meta = { path: [metaKey], not: null } as any;
    }
    if (source) docFilters.originalSource = source;
    if (originalContentId)
      docFilters.originalContentId = {
        contains: originalContentId,
        mode: "insensitive",
      } as any;
    if (createdFromParam || createdToParam) {
      const range: any = {};
      if (createdFromParam) {
        const d = new Date(createdFromParam);
        if (!isNaN(d.getTime())) range.gte = d;
      }
      if (createdToParam) {
        const d = new Date(createdToParam);
        if (!isNaN(d.getTime())) range.lte = d;
      }
      if (Object.keys(range).length) docFilters.createdAt = range;
    }
    if (updatedFromParam || updatedToParam) {
      const range: any = {};
      if (updatedFromParam) {
        const d = new Date(updatedFromParam);
        if (!isNaN(d.getTime())) range.gte = d;
      }
      if (updatedToParam) {
        const d = new Date(updatedToParam);
        if (!isNaN(d.getTime())) range.lte = d;
      }
      if (Object.keys(range).length) docFilters.updatedAt = range;
    }
  }

  const docWhere: Record<string, unknown> = {};
  if (Object.keys(docFilters).length) {
    Object.assign(docWhere, docFilters);
  }

  const titleDocs = await prisma.doc.findMany({
    where: {
      ...docWhere,
      title: { contains: q, mode: "insensitive" as const },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      path: true,
    },
    take,
  });

  // Fetch more sections than needed then de-dupe to docs
  const sections = await prisma.docSection.findMany({
    where: {
      text: { contains: q, mode: "insensitive" as const },
      ...(Object.keys(docWhere).length ? { doc: docWhere } : {}),
    },
    select: {
      id: true,
      text: true,
      doc: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
          path: true,
        },
      },
    },
    take: Math.min(take * 3, 500),
  });

  const qLower = q.toLowerCase();
  const hitsMap = new Map<
    string,
    {
      id: string;
      title: string;
      updatedAt: string;
      path?: string | null;
      snippet?: string;
    }
  >();
  for (const d of titleDocs) {
    hitsMap.set(d.id, {
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
      path: d.path,
      snippet: undefined,
    });
    if (hitsMap.size >= take) break;
  }

  for (const s of sections) {
    if (hitsMap.size >= take) break;
    const d = s.doc;
    if (!d) continue;
    if (!hitsMap.has(d.id)) {
      const snippet = buildSnippet(s.text || "", qLower);
      hitsMap.set(d.id, {
        id: d.id,
        title: d.title,
        updatedAt: d.updatedAt.toISOString(),
        path: d.path,
        snippet,
      });
      if (hitsMap.size >= take) break;
    }
  }

  const items = Array.from(hitsMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  try {
    console.log(`[api/docs/search] q="${q}" items=${items.length}`);
  } catch {}
  return json({ items });
}

function buildSnippet(text: string, qLower: string): string | undefined {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + qLower.length + 60);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}
