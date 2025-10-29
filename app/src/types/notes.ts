export type DocItem = { id: string; title: string; createdAt: string };

export type UmapPoint = {
  docId: string;
  x: number;
  y: number;
  z?: number | null;
};

export type UmapRun = { id: string; dims: number };
