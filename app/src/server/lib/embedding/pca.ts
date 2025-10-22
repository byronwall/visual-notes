import { SVD } from "svd-js";

export function projectWithPCA(
  dataMatrix: number[][],
  numComponents: number
): number[][] {
  if (!Array.isArray(dataMatrix) || dataMatrix.length === 0) return [];
  const numSamples = dataMatrix.length;
  const numFeatures = dataMatrix[0]?.length || 0;
  if (numFeatures === 0) return [];

  const k = Math.max(
    1,
    Math.min(numComponents, Math.min(numSamples, numFeatures))
  );

  // Mean-center each feature (column)
  const means = new Array<number>(numFeatures).fill(0);
  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < numSamples; i++) sum += dataMatrix[i][j] || 0;
    means[j] = sum / numSamples;
  }
  const X: number[][] = new Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const row = dataMatrix[i];
    const centered = new Array<number>(numFeatures);
    for (let j = 0; j < numFeatures; j++)
      centered[j] = (row[j] || 0) - means[j];
    X[i] = centered;
  }

  // If samples >= features, compute SVD(X) and return U_k * S_k
  if (numSamples >= numFeatures) {
    const { u, q } = SVD(X);
    const singularValues = q as number[];
    const U = u as number[][];
    const components = Math.min(
      k,
      Math.min(U[0]?.length || 0, singularValues.length)
    );
    const projected: number[][] = new Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const row = new Array<number>(components).fill(0);
      for (let c = 0; c < components; c++) {
        row[c] = (U[i][c] || 0) * (singularValues[c] || 0);
      }
      projected[i] = row;
    }
    return projected;
  }

  // Otherwise, samples < features. Compute SVD on X^T and project via X * V_k
  const Xt: number[][] = Array.from({ length: numFeatures }, (_, j) => {
    const col = new Array<number>(numSamples);
    for (let i = 0; i < numSamples; i++) col[i] = X[i][j] || 0;
    return col;
  });
  const { u: u_t } = SVD(Xt);
  const U_t = u_t as number[][]; // n x n; columns are right singular vectors of X
  const components = Math.min(k, U_t[0]?.length || 0);

  // Build V_k (n x components) from first `components` columns of U_t
  const V_k: number[][] = Array.from({ length: numFeatures }, (_, j) => {
    const row = new Array<number>(components);
    for (let c = 0; c < components; c++) row[c] = U_t[j][c] || 0;
    return row;
  });

  // projected = X * V_k  -> (m x n) * (n x components) = (m x components)
  const projected: number[][] = Array.from({ length: numSamples }, (_, i) => {
    const outRow = new Array<number>(components).fill(0);
    const Xi = X[i];
    for (let c = 0; c < components; c++) {
      let sum = 0;
      for (let j = 0; j < numFeatures; j++)
        sum += (Xi[j] || 0) * (V_k[j][c] || 0);
      outRow[c] = sum;
    }
    return outRow;
  });
  return projected;
}
