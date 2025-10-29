type Pt = { x: number; y: number };

function morton16(x16: number, y16: number): number {
  const split = (v: number) => {
    v = (v | (v << 8)) & 0x00ff00ff;
    v = (v | (v << 4)) & 0x0f0f0f0f;
    v = (v | (v << 2)) & 0x33333333;
    v = (v | (v << 1)) & 0x55555555;
    return v;
  };
  return (split(x16) << 1) | split(y16);
}

function normalize01(points: Pt[]): Pt[] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  return points.map((p) => ({ x: (p.x - minX) / dx, y: (p.y - minY) / dy }));
}

function snakedCellIndex(linear: number, gridW: number): number {
  const row = Math.floor(linear / gridW);
  const col = linear % gridW;
  if ((row & 1) === 0) return row * gridW + col;
  return row * gridW + (gridW - 1 - col);
}

export function assignToGridZOrderSnaked(
  points: Pt[],
  gridW: number,
  gridH: number
): number[] {
  console.log(`[zorder+snake] points=${points.length} grid=${gridW}x${gridH}`);
  const n = points.length;
  const capacity = gridW * gridH;
  if (capacity < n) throw new Error(`Grid too small: ${capacity} < ${n}`);
  if (n === 0) return new Array(capacity).fill(-1);

  const norm = normalize01(points);
  const keyed = norm.map((p, idx) => {
    const xi = Math.max(0, Math.min(65535, (p.x * 65535) | 0));
    const yi = Math.max(0, Math.min(65535, (p.y * 65535) | 0));
    return { idx, key: morton16(xi, yi) };
  });
  keyed.sort((a, b) => a.key - b.key);
  console.log(
    `[zorder+snake] sorted; firstKey=${keyed[0]?.key} lastKey=${
      keyed[keyed.length - 1]?.key
    }`
  );

  const mapping = new Array<number>(capacity).fill(-1);
  for (let k = 0; k < n; k++) {
    const cell = snakedCellIndex(k, gridW);
    mapping[cell] = keyed[k]!.idx;
  }
  return mapping;
}

export function bestFitGridForAspect(n: number, aspect: number) {
  const a = aspect > 0 ? aspect : 1;
  let w = Math.max(1, Math.ceil(Math.sqrt(n * a)));
  let best = { w, h: Math.ceil(n / w), err: Number.POSITIVE_INFINITY } as {
    w: number;
    h: number;
    err: number;
  };
  for (let candW = Math.max(1, w - 6); candW <= w + 6; candW++) {
    const candH = Math.ceil(n / candW);
    const gridAspect = candW / candH;
    const slack = candW * candH - n;
    const err = Math.abs(Math.log(gridAspect / a)) + slack / Math.max(1, n);
    if (err < best.err) best = { w: candW, h: candH, err };
  }
  return [best.w, best.h] as const;
}

export function gridCellCenterWorld(
  cell: number,
  gridW: number,
  gridH: number,
  cellSize: number,
  originX: number,
  originY: number
) {
  const row = Math.floor(cell / gridW);
  const col = cell % gridW;
  const width = gridW * cellSize;
  const height = gridH * cellSize;
  const x = originX - width / 2 + col * cellSize + cellSize / 2;
  const y = originY - height / 2 + row * cellSize + cellSize / 2;
  return { x, y };
}
