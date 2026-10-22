import type { APIEvent } from "@solidjs/start/server";
import {
  ImageRejectedError,
  importImageFromUrl,
  MAX_IMAGE_BYTES,
  storeImageBytes,
} from "~/server/lib/doc-image-store";
import type { DocImageUploadResult } from "~/services/doc-images/doc-images.shared";

// The editor posts pasted/dropped image bytes here (a server action would
// round-trip binary through its serializer), or JSON `{ url }` to copy an
// image that was pasted as a link to another site.

export async function POST(event: APIEvent) {
  const request = event.request;
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        url?: unknown;
      } | null;
      const url = typeof body?.url === "string" ? body.url.trim() : "";
      if (!url) return Response.json({ error: "Missing url" }, { status: 400 });
      const { stored, bytes } = await importImageFromUrl(url);
      return Response.json(result(stored.publicUrl, stored.mime, bytes));
    }

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) return tooLarge();
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return tooLarge();
    const stored = await storeImageBytes(buffer, "The image");
    return Response.json(result(stored.publicUrl, stored.mime, buffer.length));
  } catch (error) {
    if (error instanceof ImageRejectedError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("[doc-images] upload failed", error);
    return Response.json({ error: "Image upload failed" }, { status: 500 });
  }
}

const result = (
  src: string,
  mime: string,
  bytes: number,
): DocImageUploadResult => ({ src, mime, bytes });

const tooLarge = () =>
  Response.json(
    { error: `The image is larger than ${MAX_IMAGE_BYTES / 1e6} MB` },
    { status: 413 },
  );
