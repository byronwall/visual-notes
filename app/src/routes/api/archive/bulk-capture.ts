import { bulkCapturePayloadSchema } from "~/server/lib/archive/types";
import {
  buildArchiveUnauthorizedResponse,
  isArchiveIngestAuthorized,
} from "~/server/lib/archive/auth";
import { ingestBulkArchiveCapture } from "~/services/archive/archive.ingest";

export async function POST(event: { request: Request }) {
  if (!isArchiveIngestAuthorized(event.request)) {
    return buildArchiveUnauthorizedResponse();
  }

  try {
    const body = await event.request.json();
    const payload = bulkCapturePayloadSchema.parse(body);
    const result = await ingestBulkArchiveCapture(payload);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || "Invalid request" },
      { status: 400 },
    );
  }
}

