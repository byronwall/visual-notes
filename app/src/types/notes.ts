export type DocItem = {
  id: string;
  title: string;
  createdAt: string;
  path?: string | null;
};

export type UmapPoint = {
  docId: string;
  x: number;
  y: number;
  z?: number | null;
};

export type UmapRun = { id: string; dims: number };
