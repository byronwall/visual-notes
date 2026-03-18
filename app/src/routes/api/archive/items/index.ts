import { fetchArchivedPages } from "~/services/archive/archive.service";

export async function GET(event: { request: Request }) {
  const url = new URL(event.request.url);
  const items = await fetchArchivedPages({
    group: url.searchParams.get("group") || undefined,
    hostname: url.searchParams.get("hostname") || undefined,
    capturedFrom: url.searchParams.get("capturedFrom") || undefined,
    capturedTo: url.searchParams.get("capturedTo") || undefined,
  });
  return Response.json({ items });
}

