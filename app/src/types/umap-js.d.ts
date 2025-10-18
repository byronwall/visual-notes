declare module "umap-js" {
  export interface UmapOptions {
    nComponents?: number;
    nNeighbors?: number;
    minDist?: number;
    metric?: "cosine" | "euclidean" | string;
  }
  export default class UMAP {
    constructor(options?: UmapOptions);
    fit(X: number[][]): number[][];
    transform?(X: number[][]): number[][];
  }
}
