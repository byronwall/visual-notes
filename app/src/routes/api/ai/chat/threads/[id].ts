import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";
import { parseCookie, MAGIC_COOKIE_NAME } from "~/server/magic-auth";
import { createHash } from "crypto";

function getUserIdFromRequest(request: Request): string {
  const cookies = parseCookie(request.headers.get("cookie"));
  const token = cookies[MAGIC_COOKIE_NAME] || "anonymous";
  const hash = createHash("sha256").update(token).digest("hex");
  return `magic_${hash.slice(0, 24)}`;
}

export async function GET(event: APIEvent) {
  const userId = getUserIdFromRequest(event.request);
  const id = event.params.id!;
  const thread = await prisma.chatThread.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          contentHtml: true,
          isEdited: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!thread) return json({ error: "Not found" }, { status: 404 });
  return json({ item: thread });
}


