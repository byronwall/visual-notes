import type { APIEvent } from "@solidjs/start/server";
import {
  DOC_FILE_MAX_BYTES,
  FileRejectedError,
  importFileFromUrl,
  storeFileBytes,
  type StoredFile,
} from "~/server/lib/doc-file-store";
import type { DocFileUploadResult } from "~/services/doc-files/doc-files.shared";

// The editor posts dropped or picked file bytes here, with the file name in
// `x-file-name` (URI-encoded), or JSON `{ url, name? }` to copy a public file.

export async function POST(event: APIEvent) {
  const request = event.request;
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("application/json")) {
      const body = (await request.json().catch(() => null)) as {
        url?: unknown;
        name?: unknown;
      } | null;
      const url = typeof body?.url === "string" ? body.url.trim() : "";
      if (!url) return Response.json({ error: "Missing url" }, { status: 400 });
      const name = typeof body?.name === "string" ? body.name : undefined;
      return Response.json(result(await importFileFromUrl(url, { name })));
    }

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > DOC_FILE_MAX_BYTES) return tooLarge();
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length > DOC_FILE_MAX_BYTES) return tooLarge();
    const stored = await storeFileBytes(buffer, {
      name: headerName(request.headers.get("x-file-name")),
      mime: type,
    });
    return Response.json(result(stored));
  } catch (error) {
    if (error instanceof FileRejectedError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("[doc-files] upload failed", error);
    return Response.json({ error: "File upload failed" }, { status: 500 });
  }
}

function headerName(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const result = ({
  src,
  name,
  mime,
  bytes,
}: StoredFile): DocFileUploadResult => ({
  src,
  name,
  mime,
  bytes,
});

const tooLarge = () =>
  Response.json(
    { error: `The file is larger than ${DOC_FILE_MAX_BYTES / 1e6} MB` },
    { status: 413 },
  );
