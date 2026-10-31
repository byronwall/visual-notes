import type { Accessor } from "solid-js";
import { createAsync } from "@solidjs/router";
import { fetchDocs } from "~/services/docs.service";
import {
  fetchLatestUmapRun,
  fetchUmapPoints,
} from "~/services/umap.service";
import type { UmapPoint } from "~/types/notes";
import { createKeptAsync } from "~/utils/kept-async";

export function useDocsResource() {
  return createAsync(() => fetchDocs());
}

export function useUmapRunResource() {
  return createKeptAsync(() => fetchLatestUmapRun());
}

export function useUmapPointsResource(runId: Accessor<string | undefined>) {
  return createKeptAsync(() => {
    const id = runId();
    if (!id) return Promise.resolve([] as UmapPoint[]);
    return fetchUmapPoints(id);
  });
}
