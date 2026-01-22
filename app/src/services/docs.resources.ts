import type { Accessor } from "solid-js";
import { createAsync } from "@solidjs/router";
import { fetchDocs } from "~/services/docs.service";
import {
  fetchLatestUmapRun,
  fetchUmapPoints,
} from "~/services/umap.service";
import type { DocItem, UmapPoint, UmapRun } from "~/types/notes";

export function useDocsResource() {
  return createAsync(() => fetchDocs());
}

export function useUmapRunResource() {
  return createAsync(() => fetchLatestUmapRun());
}

export function useUmapPointsResource(runId: Accessor<string | undefined>) {
  return createAsync(() => {
    const id = runId();
    if (!id) return Promise.resolve([] as UmapPoint[]);
    return fetchUmapPoints(id);
  });
}
