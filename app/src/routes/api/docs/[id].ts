import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const id = event.params?.id as string;
  if (!id) return json({ error: "Missing id" }, { status: 400 });
  const doc = await (prisma as any).doc.findUnique({
    where: { id },
    select: { id: true, title: true, html: true },
  });
  if (!doc) return json({ error: "Not found" }, { status: 404 });
  return json(doc);
}
