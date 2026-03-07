import type { SimpleSelectItem } from "~/components/ui/simple-select";

export type UmapRun = {
  id: string;
  dims: number;
  params: Record<string, unknown> | null;
  embeddingRunId: string;
  hasArtifact: boolean;
  createdAt: string;
};

export type EmbeddingRun = { id: string };

export type UmapMetric = "cosine" | "euclidean";
export type UmapInit = "random" | "spectral";

export type UmapFormState = {
  creating: boolean;
  showAdvanced: boolean;
  selectedEmbedding: string;
  dims: 2 | 3;
  pcaVarsToKeep: string;
  nNeighbors: string;
  minDist: string;
  metric: UmapMetric;
  learningRate: string;
  nEpochs: string;
  localConnectivity: string;
  repulsionStrength: string;
  negativeSampleRate: string;
  setOpMixRatio: string;
  spread: string;
  init: UmapInit;
  activeJobId: string;
};

export type SelectItem = SimpleSelectItem;

export const DIMS_ITEMS: SelectItem[] = [
  { label: "2D", value: "2" },
  { label: "3D", value: "3" },
];

export const METRIC_ITEMS: SelectItem[] = [
  { label: "cosine", value: "cosine" },
  { label: "euclidean", value: "euclidean" },
];

export const INIT_ITEMS: SelectItem[] = [
  { label: "spectral", value: "spectral" },
  { label: "random", value: "random" },
];
