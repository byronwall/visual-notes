import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { UmapPoint, UmapRun } from "~/types/notes";
import { parseUmapRegionsSnapshot } from "~/services/umap/umap.regions";

export type NearbyUmapDoc = {
  id: string;
  title: string;
  path?: string | null;
  x: number;
  y: number;
  distance: number;
  samePath: boolean;
};

export type NearbyUmapDocsResult = {
  runId?: string;
  points: NearbyUmapDoc[];
};

export const fetchLatestUmapRun = query(
  async (): Promise<UmapRun | undefined> => {
    "use server";
    const run = await prisma.umapRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, dims: true, regionsJson: true },
    });
    if (run) {
      try {
        console.log(
          `[services] fetchLatestUmapRun: id=${run.id} dims=${run.dims}`
        );
      } catch {}
    }
    return run
      ? {
          id: run.id,
          dims: run.dims,
          regions: parseUmapRegionsSnapshot(run.regionsJson),
        }
      : undefined;
  },
  "umap-latest-run"
);

export const fetchUmapPoints = query(
  async (runId: string): Promise<UmapPoint[]> => {
    "use server";
    if (!runId) throw new Error("Missing runId");
    const run = await prisma.umapRun.findUnique({
      where: { id: runId },
      select: { id: true, dims: true },
    });
    if (!run) throw new Error("Run not found");
    const pts = await prisma.umapPoint.findMany({
      where: { runId },
      select: { docId: true, x: true, y: true, z: true },
    });
    try {
      console.log(
        `[services] fetchUmapPoints: runId=${runId} count=${pts.length}`
      );
    } catch {}
    return pts.map((p) => ({
      docId: p.docId,
      x: p.x,
      y: p.y,
      z: p.z,
    }));
  },
  "umap-points"
);

export const fetchNearbyUmapDocs = query(
  async (
    input:
      | {
          docId: string;
          take?: number;
        }
      | undefined
  ): Promise<NearbyUmapDocsResult> => {
    "use server";
    const docId = String(input?.docId || "").trim();
    if (!docId) return { points: [] };
    const take = Math.max(6, Math.min(80, input?.take ?? 32));

    const latestRun = await prisma.umapRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latestRun) return { points: [] };

    const current = await prisma.umapPoint.findUnique({
      where: { runId_docId: { runId: latestRun.id, docId } },
      select: {
        x: true,
        y: true,
        doc: { select: { path: true } },
      },
    });
    if (!current) return { runId: latestRun.id, points: [] };

    const currentPath = String(current.doc.path || "").trim();
    const rows = await prisma.umapPoint.findMany({
      where: { runId: latestRun.id },
      select: {
        docId: true,
        x: true,
        y: true,
        doc: {
          select: {
            title: true,
            path: true,
          },
        },
      },
    });

    const withDistance = rows.map((row) => {
      const dx = row.x - current.x;
      const dy = row.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const rowPath = String(row.doc.path || "").trim();
      return {
        id: row.docId,
        title: row.doc.title,
        path: row.doc.path,
        x: row.x,
        y: row.y,
        distance,
        samePath: currentPath.length > 0 && currentPath === rowPath,
      };
    });

    const byDistance = withDistance
      .slice()
      .sort((a, b) => a.distance - b.distance || a.title.localeCompare(b.title));
    const nearest = byDistance.slice(0, take);
    const samePathExtra = byDistance
      .filter((item) => item.id !== docId && item.samePath)
      .slice(0, 8);

    const combinedById = new Map<string, NearbyUmapDoc>();
    for (const item of [...nearest, ...samePathExtra]) {
      combinedById.set(item.id, item);
    }

    const points = Array.from(combinedById.values()).sort(
      (a, b) =>
        a.distance - b.distance ||
        Number(b.samePath) - Number(a.samePath) ||
        a.title.localeCompare(b.title)
    );

    return { runId: latestRun.id, points };
  },
  "umap-nearby-docs"
);
