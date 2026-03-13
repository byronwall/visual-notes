import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import {
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";
import { buildDocPreviewText } from "./docs.queries";

export type DocShareSummary = {
  id: string;
  slug: string;
  shareUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicSharedDoc = {
  id: string;
  title: string;
  html: string;
  markdown?: string | null;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  updatedAt: string;
  share: DocShareSummary;
  previewText: string;
};

export const fetchDocShare = query(
  async (docId: string): Promise<DocShareSummary | null> => {
    "use server";
    const id = String(docId || "").trim();
    if (!id) return null;
    const share = await prisma.docShare.findUnique({
      where: { docId: id },
      select: {
        id: true,
        slug: true,
        shareUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!share) return null;
    return {
      id: share.id,
      slug: share.slug,
      shareUrl: share.shareUrl,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    };
  },
  "doc-share-by-doc-id",
);

export const fetchPublicSharedDoc = query(
  async (slug: string): Promise<PublicSharedDoc | null> => {
    "use server";
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return null;

    const share = await prisma.docShare.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        slug: true,
        shareUrl: true,
        createdAt: true,
        updatedAt: true,
        doc: {
          select: {
            id: true,
            title: true,
            html: true,
            markdown: true,
            path: true,
            meta: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!share?.doc) return null;

    const html = sanitizeHtmlContent(
      share.doc.html || normalizeMarkdownToHtml(share.doc.markdown),
    );

    return {
      id: share.doc.id,
      title: share.doc.title,
      html,
      markdown: share.doc.markdown,
      path: share.doc.path,
      meta: share.doc.meta as Record<string, unknown> | null,
      updatedAt: share.doc.updatedAt.toISOString(),
      share: {
        id: share.id,
        slug: share.slug,
        shareUrl: share.shareUrl,
        createdAt: share.createdAt.toISOString(),
        updatedAt: share.updatedAt.toISOString(),
      },
      previewText: buildDocPreviewText(share.doc.markdown, share.doc.html, 220),
    };
  },
  "doc-share-public",
);
