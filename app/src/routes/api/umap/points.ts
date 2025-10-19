import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const runId = url.searchParams.get("runId");
  if (!runId) return json({ error: "Missing runId" }, { status: 400 });

  const run = await prisma.umapRun.findUnique({
    where: { id: runId },
    select: { id: true, dims: true },
  });
  if (!run) return json({ error: "Run not found" }, { status: 404 });

  const pts = await prisma.umapPoint.findMany({
    where: { runId },
    select: { docId: true, x: true, y: true, z: true },
  });
  return json({
    runId,
    dims: run.dims,
    points: pts,
    meta: { count: pts.length },
  });
}
