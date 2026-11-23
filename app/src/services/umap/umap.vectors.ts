export type UmapVectorRow = {
  docId: string;
  vector: number[];
};

export type PreparedUmapVectorRows = {
  rows: UmapVectorRow[];
  targetDims: number;
  droppedInvalid: number;
  droppedMismatched: number;
  dimCounts: Array<{ dims: number; count: number }>;
};

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function prepareUmapVectorRows(rows: UmapVectorRow[]): PreparedUmapVectorRows {
  const dimCounts = new Map<number, number>();
  const validRows: UmapVectorRow[] = [];
  let droppedInvalid = 0;

  for (const row of rows) {
    if (!isFiniteNumberArray(row.vector) || row.vector.length === 0) {
      droppedInvalid += 1;
      continue;
    }

    validRows.push(row);
    dimCounts.set(row.vector.length, (dimCounts.get(row.vector.length) ?? 0) + 1);
  }

  const sortedDimCounts = Array.from(dimCounts.entries())
    .map(([dims, count]) => ({ dims, count }))
    .sort((a, b) => b.count - a.count || b.dims - a.dims);

  const targetDims = sortedDimCounts[0]?.dims ?? 0;
  const rowsWithTargetDims = validRows.filter((row) => row.vector.length === targetDims);
  const droppedMismatched = validRows.length - rowsWithTargetDims.length;

  return {
    rows: rowsWithTargetDims,
    targetDims,
    droppedInvalid,
    droppedMismatched,
    dimCounts: sortedDimCounts,
  };
}
