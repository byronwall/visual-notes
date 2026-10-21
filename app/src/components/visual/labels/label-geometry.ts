export type Point = { x: number; y: number };

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type LabelTextAnchor = "start" | "middle" | "end";

/** Canvas world size used by the seeded fallback layout and label spacing. */
export const SPREAD = 1000;

export function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function truncateLabelText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return "…";
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

export function wrapRegionTitle(title: string, maxChars = 16, maxLines = 3) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [truncateLabelText(title, maxChars)];
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (!current) {
      lines.push(truncateLabelText(word, maxChars));
      if (lines.length === maxLines) return lines;
      continue;
    }
    lines.push(current);
    if (lines.length === maxLines - 1) {
      const remainder = [word, ...words.slice(index + 1)].join(" ");
      lines.push(truncateLabelText(remainder, maxChars));
      return lines;
    }
    current = word;
  }
  if (current) {
    lines.push(truncateLabelText(current, maxChars));
  }
  return lines.slice(0, maxLines);
}

export function computeLabelBox(args: {
  textAnchor: LabelTextAnchor;
  textX: number;
  topY: number;
  labelWidth: number;
  labelHeight: number;
  labelFontSize: number;
}) {
  const minX =
    args.textAnchor === "start"
      ? args.textX
      : args.textAnchor === "end"
        ? args.textX - args.labelWidth
        : args.textX - args.labelWidth / 2;
  return {
    minX,
    minY: args.topY,
    maxX: minX + args.labelWidth,
    maxY: args.topY + args.labelHeight,
    textY: args.topY + args.labelFontSize * 0.9,
  };
}

export type LabelBox = ReturnType<typeof computeLabelBox>;

/** Distance a box must move on each axis to sit inside `bounds`. */
export function measureShiftIntoBounds(box: Bounds, bounds: Bounds) {
  const shiftX =
    (box.minX < bounds.minX ? bounds.minX - box.minX : 0) +
    (box.maxX > bounds.maxX ? bounds.maxX - box.maxX : 0);
  const shiftY =
    (box.minY < bounds.minY ? bounds.minY - box.minY : 0) +
    (box.maxY > bounds.maxY ? bounds.maxY - box.maxY : 0);
  return { shiftX, shiftY };
}

export function shiftLabelBox(box: LabelBox, shiftX: number, shiftY: number) {
  return {
    ...box,
    minX: box.minX + shiftX,
    maxX: box.maxX + shiftX,
    minY: box.minY + shiftY,
    maxY: box.maxY + shiftY,
    textY: box.textY + shiftY,
  };
}

/** Moves a label box inside `bounds`, or returns it unchanged without bounds. */
export function shiftLabelBoxIntoBounds(box: LabelBox, bounds?: Bounds) {
  if (!bounds) return box;
  const { shiftX, shiftY } = measureShiftIntoBounds(box, bounds);
  return shiftLabelBox(box, shiftX, shiftY);
}

/** Sum of overlap areas between `box` (grown by spacing) and placed boxes. */
export function measureBoxOverlap(
  box: Bounds,
  placed: Bounds[],
  spacingX: number,
  spacingY: number,
) {
  return placed.reduce((penalty, placedBox) => {
    const overlapX = Math.max(
      0,
      Math.min(box.maxX + spacingX, placedBox.maxX) -
        Math.max(box.minX - spacingX, placedBox.minX),
    );
    const overlapY = Math.max(
      0,
      Math.min(box.maxY + spacingY, placedBox.maxY) -
        Math.max(box.minY - spacingY, placedBox.minY),
    );
    return penalty + overlapX * overlapY;
  }, 0);
}

export function toBounds(box: Bounds): Bounds {
  return { minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY };
}
