import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import type { UmapPoint, UmapRun } from "~/types/notes";

export const fetchLatestUmapRun = query(
  async (): Promise<UmapRun | undefined> => {
    "use server";
    const run = await prisma.umapRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, dims: true },
    });
    if (run) {
      try {
        console.log(
          `[services] fetchLatestUmapRun: id=${run.id} dims=${run.dims}`
        );
      } catch {}
    }
    return run ?? undefined;
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
