export function resolveActiveRange(
  headingAbsTops: number[],
  visibleTopAbs: number,
  visibleBottomAbs: number
) {
  if (headingAbsTops.length === 0) {
    return { startIdx: 0, endIdx: 0 };
  }

  const firstAfterTop = headingAbsTops.findIndex((top) => top > visibleTopAbs);

  let startIdx = 0;
  if (firstAfterTop === -1) {
    startIdx = headingAbsTops.length - 1;
  } else if (firstAfterTop === 0) {
    startIdx = 0;
  } else {
    startIdx = firstAfterTop - 1;
  }

  const firstAfterBottom = headingAbsTops.findIndex((top) => top > visibleBottomAbs);

  let endIdx = 0;
  if (firstAfterBottom === -1) {
    endIdx = headingAbsTops.length - 1;
  } else if (firstAfterBottom === 0) {
    endIdx = 0;
  } else {
    endIdx = firstAfterBottom - 1;
  }

  if (endIdx < startIdx) endIdx = startIdx;
  if (endIdx >= headingAbsTops.length) endIdx = headingAbsTops.length - 1;

  return { startIdx, endIdx };
}
