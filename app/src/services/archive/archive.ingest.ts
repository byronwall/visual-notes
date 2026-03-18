import { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import {
  persistDataImage,
  resolveDocImageStorageDir,
} from "~/server/lib/inline-image-migration";
import { persistArchiveHtml } from "~/server/lib/archive/html-storage";
import { normalizeArchivedPageUrl } from "~/server/lib/archive/url";
import type {
  BulkCapturePayload,
  TargetedCapturePayload,
} from "~/server/lib/archive/types";

type PageWithCounts = {
  id: string;
  title: string;
  normalizedUrl: string;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value == null
    ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
    : (value as Prisma.InputJsonValue);
}

async function upsertArchivedPage(input: {
  url: string;
  title: string;
  groupName?: string;
  capturedAt: Date;
  meta?: Record<string, unknown>;
}): Promise<PageWithCounts> {
  const normalized = normalizeArchivedPageUrl(input.url);
  const meta = input.meta ?? {};

  const row = await prisma.archivedPage.upsert({
    where: { normalizedUrl: normalized.normalizedUrl },
    update: {
      originalUrl: normalized.originalUrl,
      title: input.title,
      siteHostname: normalized.hostname,
      groupName: input.groupName ?? null,
      lastCapturedAt: input.capturedAt,
      meta: toJson(meta),
    },
    create: {
      normalizedUrl: normalized.normalizedUrl,
      originalUrl: normalized.originalUrl,
      title: input.title,
      siteHostname: normalized.hostname,
      groupName: input.groupName ?? null,
      lastCapturedAt: input.capturedAt,
      meta: toJson(meta),
    },
    select: {
      id: true,
      title: true,
      normalizedUrl: true,
    },
  });

  return row;
}

export async function ingestBulkArchiveCapture(payload: BulkCapturePayload) {
  const capturedAt = new Date(payload.capturedAt);
  const created: { pageId: string; snapshotId: string }[] = [];

  for (const item of payload.items) {
    const page = await upsertArchivedPage({
      url: item.url,
      title: item.title,
      groupName: payload.groupName,
      capturedAt,
      meta: item.meta,
    });

    const htmlFile = await persistArchiveHtml(item.html);
    const snapshot = await prisma.archivedPageSnapshot.create({
      data: {
        archivedPageId: page.id,
        captureMode: "bulk",
        capturedAt,
        title: item.title,
        groupName: payload.groupName,
        htmlPath: htmlFile.htmlPath,
        htmlHash: htmlFile.htmlHash,
        meta: toJson(item.meta ?? {}),
        textSnippet: item.textSnippet ?? null,
        extensionPayload: toJson({
          ...(item.extensionPayload ?? {}),
          tabId: item.tabId ?? null,
          windowId: payload.windowId ?? null,
        }),
      },
      select: { id: true },
    });
    created.push({ pageId: page.id, snapshotId: snapshot.id });
  }

  return {
    ok: true,
    createdCount: created.length,
    items: created,
  };
}

export async function ingestTargetedArchiveCapture(
  payload: TargetedCapturePayload,
) {
  const capturedAt = new Date(payload.capturedAt);
  const page = await upsertArchivedPage({
    url: payload.url,
    title: payload.title,
    groupName: payload.groupName,
    capturedAt,
      meta: payload.meta,
  });

  let snapshotId: string | null = null;
  if (!payload.skipSnapshot && payload.html) {
    const htmlFile = await persistArchiveHtml(payload.html);
    const snapshot = await prisma.archivedPageSnapshot.create({
      data: {
        archivedPageId: page.id,
        captureMode: "targeted",
        capturedAt,
        title: payload.title,
        groupName: payload.groupName ?? null,
        htmlPath: htmlFile.htmlPath,
        htmlHash: htmlFile.htmlHash,
        meta: toJson(payload.meta ?? {}),
        textSnippet: payload.textSnippet ?? null,
        extensionPayload: toJson(payload.extensionPayload ?? {}),
      },
      select: { id: true },
    });
    snapshotId = snapshot.id;
  }

  const imageUrls: string[] = [];
  if (payload.screenshotDataUrl) {
    const persisted = await persistDataImage(
      payload.screenshotDataUrl,
      resolveDocImageStorageDir(),
    );
    imageUrls.push(persisted.publicUrl);
  }

  const note = await prisma.archivedPageNote.create({
    data: {
      archivedPageId: page.id,
      snapshotId,
      noteText: payload.noteText?.trim() || "Screenshot added",
      imageUrls,
      sourceContext: toJson(payload.selection ?? null),
    },
    select: { id: true },
  });

  return {
    ok: true,
    pageId: page.id,
    snapshotId,
    noteId: note.id,
    createdImageCount: imageUrls.length,
  };
}
