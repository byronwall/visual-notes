import type {
  UmapPoint,
  UmapRunDetail,
} from "~/services/umap/umap.queries";

export type UmapDetailData = {
  meta: UmapRunDetail;
  points: UmapPoint[];
};
