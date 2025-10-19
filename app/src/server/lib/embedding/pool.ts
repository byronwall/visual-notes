export function meanPool(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const dim = vectors[0].length || 0;
  if (!dim) return [];
  const acc = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) acc[i] += v[i] || 0;
  }
  const n = vectors.length;
  for (let i = 0; i < dim; i++) acc[i] /= n;
  return acc;
}
