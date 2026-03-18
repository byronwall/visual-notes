import { fetchArchivedPageDetail } from "~/services/archive/archive.service";

export async function GET(event: { params: { id?: string } }) {
  try {
    const detail = await fetchArchivedPageDetail(String(event.params.id || ""));
    return Response.json(detail);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || "Not found" },
      { status: 404 },
    );
  }
}

