import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { getSession } from "@solid-mediakit/auth";
import { authOptions } from "~/server/auth";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const session = await getSession(event.request, authOptions);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      days: {
        orderBy: { position: "asc" },
        include: {
          passages: {
            orderBy: { position: "asc" },
            include: { passage: true },
          },
        },
      },
    },
  });
  return json(plan);
}
