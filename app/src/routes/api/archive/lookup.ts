import { lookupArchivedPageByUrl } from "~/services/archive/archive.service";

export async function GET(event: { request: Request }) {
  const url = new URL(event.request.url);
  const target = url.searchParams.get("url") || "";
  const result = await lookupArchivedPageByUrl(target);
  return Response.json(result);
}

