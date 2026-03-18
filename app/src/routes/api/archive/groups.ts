import { fetchArchivedPageGroups } from "~/services/archive/archive.service";

export async function GET() {
  const groups = await fetchArchivedPageGroups();
  return Response.json({ groups });
}

