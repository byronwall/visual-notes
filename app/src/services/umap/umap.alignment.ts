/**
 * A 2D similarity transform: `p' = M·p + t`, where `M` is a uniformly scaled
 * rotation or reflection. Stored on `UmapRun.alignment` so points projected
 * into a retrained model land in the same frame as the map it replaced.
 */
export type UmapAlignment = {
  version: 1;
  /** Row-major 2x2 matrix [m00, m01, m10, m11]. */
  matrix: [number, number, number, number];
  translation: [number, number];
  scale: number;
  reflected: boolean;
  /** Root-mean-square distance between aligned and target points. */
  rms: number;
  pairCount: number;
};

export type Point2 = { x: number; y: number };

/**
 * Orthogonal Procrustes with scale: the similarity transform that maps
 * `source[i]` closest to `target[i]` in least squares. In 2D the optimal
 * rotation has a closed form, so this tries the proper rotation and the
 * reflected one and keeps the better fit. Returns null with fewer than three
 * pairs or a degenerate (single-point) source.
 */
export function fitSimilarityTransform(
  source: Point2[],
  target: Point2[],
): UmapAlignment | null {
  const n = Math.min(source.length, target.length);
  if (n < 3) return null;

  const sourceMean = mean(source, n);
  const targetMean = mean(target, n);
  let sourceNorm = 0;
  // Cross-covariance terms for H = Σ a·bᵀ of the centered points.
  let hxx = 0;
  let hxy = 0;
  let hyx = 0;
  let hyy = 0;
  for (let i = 0; i < n; i += 1) {
    const ax = source[i]!.x - sourceMean.x;
    const ay = source[i]!.y - sourceMean.y;
    const bx = target[i]!.x - targetMean.x;
    const by = target[i]!.y - targetMean.y;
    sourceNorm += ax * ax + ay * ay;
    hxx += ax * bx;
    hxy += ax * by;
    hyx += ay * bx;
    hyy += ay * by;
  }
  if (sourceNorm <= 1e-12) return null;

  // Proper rotation R(θ) maximizes cosθ·(hxx+hyy) + sinθ·(hxy−hyx).
  const rotC = hxx + hyy;
  const rotS = hxy - hyx;
  // Reflection R(θ)·diag(1,−1) maximizes cosθ·(hxx−hyy) + sinθ·(hxy+hyx).
  const refC = hxx - hyy;
  const refS = hxy + hyx;
  const rotFit = Math.hypot(rotC, rotS);
  const refFit = Math.hypot(refC, refS);
  const reflected = refFit > rotFit;
  const theta = reflected ? Math.atan2(refS, refC) : Math.atan2(rotS, rotC);
  const scale = (reflected ? refFit : rotFit) / sourceNorm;
  const cos = Math.cos(theta) * scale;
  const sin = Math.sin(theta) * scale;
  const matrix: UmapAlignment["matrix"] = reflected
    ? [cos, sin, sin, -cos]
    : [cos, -sin, sin, cos];
  const translation: UmapAlignment["translation"] = [
    targetMean.x - (matrix[0] * sourceMean.x + matrix[1] * sourceMean.y),
    targetMean.y - (matrix[2] * sourceMean.x + matrix[3] * sourceMean.y),
  ];
  const partial = { matrix, translation };

  let squared = 0;
  for (let i = 0; i < n; i += 1) {
    const aligned = applyAlignment(partial, source[i]!);
    squared +=
      (aligned.x - target[i]!.x) ** 2 + (aligned.y - target[i]!.y) ** 2;
  }

  return {
    version: 1,
    matrix,
    translation,
    scale,
    reflected,
    rms: Math.sqrt(squared / n),
    pairCount: n,
  };
}

export function applyAlignment(
  alignment: Pick<UmapAlignment, "matrix" | "translation">,
  point: Point2,
): Point2 {
  const [m00, m01, m10, m11] = alignment.matrix;
  return {
    x: m00 * point.x + m01 * point.y + alignment.translation[0],
    y: m10 * point.x + m11 * point.y + alignment.translation[1],
  };
}

export function parseUmapAlignment(value: unknown): UmapAlignment | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<UmapAlignment>;
  if (candidate.version !== 1) return null;
  const numbers = [
    ...(Array.isArray(candidate.matrix) ? candidate.matrix : []),
    ...(Array.isArray(candidate.translation) ? candidate.translation : []),
  ];
  if (numbers.length !== 6 || !numbers.every(Number.isFinite)) return null;
  return candidate as UmapAlignment;
}

function mean(points: Point2[], n: number): Point2 {
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    x += points[i]!.x;
    y += points[i]!.y;
  }
  return { x: x / n, y: y / n };
}
