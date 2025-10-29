import { createResource, type Accessor } from "solid-js";
import {
  fetchDocs,
  fetchLatestUmapRun,
  fetchUmapPoints,
} from "~/services/docs.service";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";

export function useDocsResource() {
  return createResource<DocItem[]>(fetchDocs);
}

export function useUmapRunResource() {
  return createResource<UmapRun | undefined>(fetchLatestUmapRun);
}

export function useUmapPointsResource(runId: Accessor<string | undefined>) {
  return createResource<UmapPoint[], string | undefined>(
    runId,
    async (id: string | undefined) => {
      if (!id) return [] as UmapPoint[];
      return fetchUmapPoints(id);
    }
  );
}
