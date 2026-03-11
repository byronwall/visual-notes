type Point = { x: number; y: number };

export type HexGridCell = {
  row: number;
  col: number;
};

export type HexGridConfig = {
  columnWidth: number;
  rowHeight: number;
  originX?: number;
  originY?: number;
};

const roundDiv = (value: number, size: number) =>
  size === 0 ? 0 : Math.round(value / size);

export function hexCellKey(cell: HexGridCell) {
  return `${cell.row}:${cell.col}`;
}

export function hexCellCenter(cell: HexGridCell, config: HexGridConfig): Point {
  const originX = config.originX ?? 0;
  const originY = config.originY ?? 0;
  const rowOffset = Math.abs(cell.row % 2) * (config.columnWidth / 2);
  return {
    x: originX + rowOffset + cell.col * config.columnWidth,
    y: originY + cell.row * config.rowHeight,
  };
}

export function nearestHexCell(point: Point, config: HexGridConfig): HexGridCell {
  const originX = config.originX ?? 0;
  const originY = config.originY ?? 0;
  const relativeY = point.y - originY;
  const roughRow = roundDiv(relativeY, config.rowHeight);

  let best = { row: roughRow, col: 0 };
  let bestDist = Number.POSITIVE_INFINITY;
  for (let row = roughRow - 1; row <= roughRow + 1; row++) {
    const rowOffset = Math.abs(row % 2) * (config.columnWidth / 2);
    const col = roundDiv(point.x - originX - rowOffset, config.columnWidth);
    for (let testCol = col - 1; testCol <= col + 1; testCol++) {
      const cell = { row, col: testCol };
      const center = hexCellCenter(cell, config);
      const dx = center.x - point.x;
      const dy = center.y - point.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = cell;
        bestDist = dist;
      }
    }
  }
  return best;
}

export function candidateHexCells(
  preferred: HexGridCell,
  maxRadius: number
): HexGridCell[] {
  const out: HexGridCell[] = [];
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let row = preferred.row - radius; row <= preferred.row + radius; row++) {
      for (let col = preferred.col - radius; col <= preferred.col + radius; col++) {
        if (
          Math.max(Math.abs(row - preferred.row), Math.abs(col - preferred.col)) !==
          radius
        ) {
          continue;
        }
        out.push({ row, col });
      }
    }
  }
  return out;
}
