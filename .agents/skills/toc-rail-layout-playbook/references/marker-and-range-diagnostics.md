# Marker and Range Diagnostics

Use this checklist when marker placement or visible-range bounds look wrong.

## A) Heading identity sanity

1. Print ordered heading keys: `level:text:occurrence`.
2. Verify repeated texts increment occurrence.
3. Verify each TOC entry resolves to a distinct DOM element.

Failure symptom:
- `topOffsets` repeat in obvious patterns (same few values over and over).

Fix:
- Use occurrence-aware lookup.

## B) Height normalization sanity

1. Capture:
   - `rootScrollHeight`
   - `effectiveContentHeight`
   - first/last heading offsets
2. If `effectiveContentHeight` is near `rootScrollHeight` but visible content ends far earlier, you are including editor filler/min-height.

Fix:
- Derive effective height from actual content block bottoms.

## C) Visible range sanity

1. Log absolute bounds:
   - `visibleTopAbs`
   - `visibleBottomAbs`
2. Confirm they are in same coordinate system as heading tops.
3. Verify `startIdx` and `endIdx` monotonicity as you scroll.

Fix:
- Do all comparisons in absolute page coordinates.

## D) Marker visibility sanity

1. Calculate edge clamp ratio from rail geometry:
   - marker half-height + safety / rail inner height
2. Ensure clamp min/max still allows meaningful spread.
3. If markers stack, apply min-gap distribution.

## E) Placement mode sanity (expanded panel)

1. Log:
   - panel height
   - viewport height
   - chosen mode (`center` or `grow-up`)
   - chosen top
2. Confirm mode changes at expected threshold.
