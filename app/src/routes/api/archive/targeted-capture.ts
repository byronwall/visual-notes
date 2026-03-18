import { targetedCapturePayloadSchema } from "~/server/lib/archive/types";
import {
  buildArchiveUnauthorizedResponse,
  isArchiveIngestAuthorized,
} from "~/server/lib/archive/auth";
import { ingestTargetedArchiveCapture } from "~/services/archive/archive.ingest";

export async function POST(event: { request: Request }) {
  if (!isArchiveIngestAuthorized(event.request)) {
    return buildArchiveUnauthorizedResponse();
  }

  try {
    const body = await event.request.json();
    const payload = targetedCapturePayloadSchema.parse(body);
    const result = await ingestTargetedArchiveCapture(payload);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || "Invalid request" },
      { status: 400 },
    );
  }
}

