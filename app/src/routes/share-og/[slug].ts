import type { APIEvent } from "@solidjs/start/server";
import { fetchPublicSharedDoc } from "~/services/doc-shares.service";
import { buildShareOgSvg } from "~/server/share-og";
import { getBaseUrl } from "~/utils/base-url";

export async function GET(event: APIEvent) {
  const slug = String(event.params.slug || "").trim();
  if (!slug) {
    return new Response("Not found", { status: 404 });
  }

  const sharedDoc = await fetchPublicSharedDoc(slug);
  if (!sharedDoc) {
    return new Response("Not found", { status: 404 });
  }

  const svg = buildShareOgSvg({
    title: sharedDoc.title,
    previewText: sharedDoc.previewText,
    path: sharedDoc.path,
    shareUrl: sharedDoc.share.shareUrl,
    baseUrl: getBaseUrl(),
  });

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
