# Time Blocks Page: Feature and UX Summary (February 23, 2026)

This document summarizes the current behavior, UX, and implementation scope of the Time Blocks page in Visual Notes.

## 1. Page Purpose

The Time Blocks page provides a weekly planning surface where users can:

- Create time blocks by dragging on the calendar grid.
- Move and resize existing blocks with direct manipulation.
- Mark blocks as fixed-time constraints.
- Quickly resolve overlap pressure (magic wand compact action).
- Review/edit/delete blocks in list form.
- Configure calendar display settings (with persistence).

## 2. Layout and Navigation

### Main page layout

- The route is configured as a full-height viewport layout.
- The overall page does not become the primary scroll container.
- The only intended vertical scrolling area is the calendar grid region.

### Header controls

- Header includes:
  - Page title (`Time Blocks`)
  - Previous / next week controls (arrow icon buttons)
  - Date picker
  - List View button
  - Summary button
  - Settings popover button
- Header controls use a low-ink/plain button treatment to reduce visual clutter.

## 3. Calendar Grid

### Grid structure

- Left scale column shows hourly markers.
- Day lanes are rendered for the selected number of days.
- Hour/quarter guide lines are shown inside each day lane.
- Header day cells and body day lanes use matching shrink behavior so widths stay aligned responsively.

### Line hierarchy

- Hour lines are visually stronger.
- Quarter-hour lines are more subtle.
- The line system is designed to stay visible without overpowering content.

### Day lane interaction gutter

- A right-side lane gutter is reserved to reduce accidental direct block interaction near the lane edge.

## 4. Time Block Rendering

### Block visuals

- Blocks use their assigned color as background.
- Fixed-time blocks display a lock icon in the top-right overlay (absolute positioned, non-layout-affecting).
- Hover state includes stronger interaction affordance:
  - elevated shadow
  - meaningful outline ring effect via layered box-shadow

### Block text behavior

- Grid blocks show title only (no start/end time line in-block).
- Titles can wrap to multiple lines.
- Overflow is clipped to block bounds and does not leak outside.

## 5. Core Interactions

### Create

- Click-drag on open grid space creates a range preview.
- Releasing opens the create/edit modal prefilled with the dragged range.
- Create ghost has a real filled background and clear border/shadow.

### Move

- Dragging a block moves start/end together.
- Supports duplicate-on-modifier behavior during move (existing behavior retained).

### Resize

- Top and bottom edges are independently resizable.
- Duration floor respects snap-minute minimum.

### Escape cancel

- `Escape` cancels active mouse interactions (create, move, resize).

## 6. Mouse Time Indicator UX

### Hover/create indicator

- A horizontal indicator tracks snapped time under the mouse.
- Time chip uses 24h format (matching left-side time style).
- Indicator line spans full lane width (not reduced by right gutter).
- Time chip flips to the opposite side of the cursor within the lane:
  - mouse on right half => chip on left
  - mouse on left half => chip on right
- Indicator line includes a white under-stroke behind blue to maintain contrast over colored blocks.

### Drag/resize indicators

- Indicators remain visible during drag operations.
- Move drag shows both new start and new end times.
- Resize drag shows the active edge time and duration:
  - compact duration format (`45m`, `1h`, `1h 15m`).

## 7. Overlap Compaction (Magic Wand)

The day-level wand action is wired to compact overlaps (instead of opening metadata summary):

- Operates per selected day.
- Separates blocks into fixed-time and non-fixed.
- Treats fixed blocks as segment boundaries.
- Reflows non-fixed blocks forward into earliest available slots within segments.
- Preserves each non-fixed block’s duration.
- Applies only changed blocks.
- Uses optimistic updates for immediate visual feedback.
- Persists via bulk update action.

## 8. Optimistic Update Behavior

- Move and resize operations apply optimistic local start/end updates immediately on pointer release.
- UI updates are visible without waiting for server roundtrip.
- On mutation error, optimistic entries are rolled back.
- Weekly refetch/reconciliation clears stale optimistic values.

## 9. Calendar Settings Popover

### Settings included

- Start hour
- End hour
- Days visible
- Snap minutes
- Hour height (px)

### Popover UX

- Single-column control stack.
- Inline icon + label on left, input on right.
- Popover uses content-driven sizing rather than rigid fixed width.

### Persistence

- Settings are saved to localStorage.
- Settings are restored on future visits/sessions.
- Storage key:
  - `time-blocks-calendar-settings-v1`

## 10. Modals and Secondary Views

### Block editor modal

- Compact vertical layout tuned to fit typical screens without unnecessary scrolling.
- No linked-note selector.
- Color range control uses visible hue gradient.
- Title field auto-focuses on open.
- `Cmd/Ctrl + Enter` triggers save/create.
- Save button displays `Cmd Enter` hint in subtle monospace text.

### List view modal

- Width tuned to fit content (not overly wide).
- Cards widened for readability.
- Titles allow up to 3 lines before truncation.
- Edit/Delete actions use icon buttons.
- Delete actions use in-app `ConfirmDialog` (no native `confirm`).

### Metadata summary modal

- Still available from header Summary action.
- No longer bound to the day wand action.

## 11. Engineering Notes

- Runtime-calculated geometry uses inline style values (`top/left/width/height` etc.) to avoid dynamic class-generation mismatches.
- Pointer/time mapping and rendered y-position mapping are unified on the same `hourHeight`-based pixel scale.
- Scroll-aware y conversion is used for mouse-time mapping to avoid drift.

## 12. Current Outcome

The page now behaves as an interaction-first scheduling surface with:

- stable and consistent geometry,
- clear visual feedback during manipulation,
- reduced UI clutter,
- persisted user display preferences,
- and improved list/editor ergonomics.
