---
name: toc-rail-layout-playbook
description: Diagnose and fix TOC/minimap rail layout bugs in SolidJS editor views, including marker positioning, viewport-bound panel placement, collapsed-vs-expanded behavior, active/visible heading tracking, and reactivity/performance churn. Use when TOC dots/lines are misplaced, heading range bounds are wrong, panel clips off-screen, or layout appears stale while editing.
---

# TOC Rail Layout Playbook

Follow this sequence when debugging TOC/minimap layout behavior.

## 1) Stabilize coordinate systems

- Compute heading and viewport bounds in one coordinate space.
- Prefer absolute page coordinates:
  - `absTop = el.getBoundingClientRect().top + window.scrollY`
- Derive visible bounds as viewport/document intersection:
  - `visibleTop = max(viewportTop, rootTop)`
  - `visibleBottom = min(viewportBottom, rootBottom)`

## 2) Resolve headings robustly

- Keep a stable item model with:
  - `level`, `text`, `occurrence`, `el`
- For duplicate heading text, resolve by `(level, text, occurrence)` not first text match.
- Prefer `item.el` while connected, then fallback to occurrence-based DOM lookup.

## 3) Marker placement rules

- Use effective content height, not raw editor `scrollHeight`, for marker normalization.
- Normalize heading position as `headingOffset / effectiveContentHeight`.
- Clamp only for marker visibility at edges (derived from marker size and rail inner height).
- If markers overlap, apply a minimum-gap distribution pass.
- Use inline style for percent top values:
  - `style={{ top: "37.5%" }}`

Read detailed marker math and diagnostics in `references/marker-and-range-diagnostics.md`.

## 4) Expanded panel placement rules

- Keep collapsed rail behavior independent from expanded panel placement math.
- For expanded panel:
  - Center when short.
  - Clamp toward top gutter when tall.
- Animate expanded panel from right (`translateX`) and fade opacity.

## 5) Recompute strategy

- Recompute heading list on debounced mutation observer (`childList + subtree + characterData`).
- Recompute marker/visible geometry on:
  - scroll
  - resize
  - debounced mutation completion
  - lightweight periodic interval (for editor text growth without structural mutations)
- Avoid synthetic recompute loops with no external signal.

## 6) Logging protocol (deduped)

Add temporary, deduped logs with a payload signature guard:

- `[TOC.markers] layout`
  - heading count
  - marker count
  - root scroll height
  - effective content height
  - top offsets
  - first/last heading ratios
- `[TOC.visible-range] computed`
  - visible top/bottom bounds
  - active index
  - visible start/end indices
  - first/last heading absolute top
- `[TOC.expand-pos] computed`
  - mode (`center` vs `grow-up`)
  - panel height
  - viewport height
  - chosen top

Remove these logs when the bug is fixed unless explicitly requested.

## 7) Final manual checks

- Verify duplicate heading texts map to unique TOC dots.
- Verify active/visible bounds move correctly while scrolling.
- Verify collapsed markers remain visible and track real heading positions.
- Verify expanded panel does not clip at narrow and wide widths.
- Verify no idle DOM churn in DevTools.

