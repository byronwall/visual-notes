export type UmapPoint = { docId: string; x: number; y: number; z?: number | null };

export type UmapRunMeta = {
  id: string;
  dims: number;
  params?: Record<string, unknown> | null;
  embeddingRunId: string;
  createdAt: string;
  count?: number;
  hasArtifact?: boolean;
  artifactPath?: string | null;
};

export type UmapRunPointsData = {
  runId: string;
  dims: number;
  points: UmapPoint[];
};

export type UmapDetailData = {
  meta: UmapRunMeta;
  dims: number;
  points: UmapPoint[];
};
