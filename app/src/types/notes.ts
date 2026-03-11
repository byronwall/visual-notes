import type { UmapRegionsSnapshot } from "~/features/umap/region-types";

export type DocItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
};

export type UmapPoint = {
  docId: string;
  x: number;
  y: number;
  z?: number | null;
};

export type UmapRun = {
  id: string;
  dims: number;
  regions?: UmapRegionsSnapshot | null;
};
