import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(event.request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "50", 10),
    200
  );
  const status = url.searchParams.get("status");
  const model = url.searchParams.get("model");

  const where: any = {};
  if (status && ["SUCCESS", "ERROR", "PARTIAL"].includes(status)) {
    where.status = status;
  }
  if (model) {
    where.model = { contains: model, mode: "insensitive" };
  }

  const requests = await prisma.llmRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: isNaN(limit) ? 50 : limit,
  });
  return json({ requests });
}
