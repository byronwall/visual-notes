import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "~/server/db";
import { resolveArchiveHtmlStorageDir } from "~/server/lib/archive/html-storage";

export async function GET(event: {
  params: { id?: string };
  request: Request;
}) {
  const snapshotId = String(event.params.id || "").trim();
  if (!snapshotId) {
    return new Response("Missing snapshot id", { status: 400 });
  }

  const snapshot = await prisma.archivedPageSnapshot.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      htmlPath: true,
      archivedPage: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!snapshot?.htmlPath) {
    return new Response("Snapshot HTML not found", { status: 404 });
  }

  const absPath = path.resolve(
    resolveArchiveHtmlStorageDir(),
    path.basename(snapshot.htmlPath),
  );
  const html = await readFile(absPath, "utf8");
  const url = new URL(event.request.url);
  const isDownload = url.searchParams.get("download") === "1";
  const filename = `${snapshot.archivedPage.title || "explorer-snapshot"}-${snapshot.id}.html`
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-");

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": isDownload
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
    },
  });
}
