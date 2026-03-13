import { action } from "@solidjs/router";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  buildShareUrlPath,
  isValidShareSlug,
  normalizeShareSlug,
} from "./doc-shares.shared";

const upsertDocShareInput = z.object({
  docId: z.string().min(1),
  slug: z.string().max(128).optional(),
});

const deleteDocShareInput = z.object({
  docId: z.string().min(1),
});

const toActionError = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

export const upsertDocShare = action(
  async (payload: z.infer<typeof upsertDocShareInput>) => {
    "use server";
    const input = upsertDocShareInput.parse(payload);
    const slug = normalizeShareSlug(input.slug);

    if (slug && !isValidShareSlug(slug)) {
      throw new Error(
        "Slug must start with a letter or number and only use letters, numbers, dashes, or underscores.",
      );
    }

    const doc = await prisma.doc.findUnique({
      where: { id: input.docId },
      select: { id: true },
    });
    if (!doc) {
      throw new Error("Note not found");
    }

    try {
      const existing = await prisma.docShare.findUnique({
        where: { docId: input.docId },
        select: { id: true },
      });
      const nextSlug = slug ?? randomUUID().replace(/-/g, "").slice(0, 24);
      const resolvedShare = existing
        ? await prisma.docShare.update({
            where: { docId: input.docId },
            data: {
              slug: nextSlug,
              shareUrl: buildShareUrlPath(nextSlug),
            },
            select: {
              id: true,
              slug: true,
              shareUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : await prisma.docShare.create({
            data: {
              docId: input.docId,
              slug: nextSlug,
              shareUrl: buildShareUrlPath(nextSlug),
            },
            select: {
              id: true,
              slug: true,
              shareUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          });

      return {
        id: resolvedShare.id,
        slug: resolvedShare.slug,
        shareUrl: resolvedShare.shareUrl,
        createdAt: resolvedShare.createdAt.toISOString(),
        updatedAt: resolvedShare.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new Error("That share slug is already in use.");
      }
      throw new Error(toActionError(error, "Unable to save share link"));
    }
  },
  "doc-share-upsert",
);

export const deleteDocShare = action(
  async (payload: z.infer<typeof deleteDocShareInput>) => {
    "use server";
    const input = deleteDocShareInput.parse(payload);
    await prisma.docShare.delete({ where: { docId: input.docId } }).catch(() => {
      throw new Error("Share link not found");
    });
    return { ok: true, docId: input.docId };
  },
  "doc-share-delete",
);
