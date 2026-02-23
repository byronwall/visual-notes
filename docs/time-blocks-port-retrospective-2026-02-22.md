# Time Blocks Port Retrospective (2026-02-22)

## Scope

This document summarizes the implementation/debugging issues encountered while porting and stabilizing the Time Blocks feature in Visual Notes, with focus on:

- SolidJS-specific pitfalls
- Drag/resize interaction bugs
- Playwright spec design and flakiness
- Tooling/instruction improvements that would reduce rework

## Primary Issues Encountered

### 1) SolidJS reactivity pitfall in block geometry rendering

#### Symptom

- Blocks appeared stacked or pinned to a stale Y position.
- Changing calendar settings (especially hour window) did not always update block positions as expected.

#### Root Cause

- Per-block geometry (`top`, `height`, `left`) was computed as one-time constants inside a `<For>` callback.
- In Solid, this can accidentally bypass reactive recomputation if derived values are not read in a tracked scope.

#### Fix

- Moved per-block geometry into a reactive accessor (`geometry()`), rendered with `<Show when={geometry()}>`.
- Recomputed top/height from reactive signals (`startHour`, `endHour`, `hourHeight`, etc.).

#### SolidJS Lesson

- In loops, treat layout math as reactive accessors/memos, not top-level constants, when it depends on signals.

---

### 2) Time-window clipping bug (off-window blocks collapsing visually)

#### Symptom

- Blocks with times outside current visible window appeared at/near the top and looked “stacked.”

#### Root Cause

- Rendering used raw start/end times without clipping to the day’s visible bounds.

#### Fix

- Added day/hour visible bounds and segment clipping (`getVisibleSegment`).
- Hidden fully out-of-window blocks; partially visible blocks are clipped before top/height calculation.

#### Implementation Note

- This separated data truth (absolute block time) from viewport truth (visible segment), which is required for calendar UIs.

---

### 3) Drag ghost missing for move/resize

#### Symptom

- During block move/resize, no ghost/preview existed, making UX feel broken.

#### Root Cause

- Only create preview existed.
- Move/resize had state updates but no dedicated overlay rendering.

#### Fix

- Added drag ghost overlay for move/resize (`data-testid="time-block-drag-ghost"`).
- Dimmed original dragged block to improve feedback.
- Kept create preview (`data-testid="time-block-create-preview"`).

---

### 4) Resize behavior instability due absolute cursor->time mapping

#### Symptom

- Resize could produce unexpected times in some paths.

#### Root Cause

- Resize converted pointer location directly into absolute date-time.
- This is sensitive to day/window boundaries and introduces avoidable conversion drift.

#### Fix

- Resize now uses delta math from the original start/end anchor (same model as move).

---

### 5) Dynamic geometry styling path caused visual clumping despite correct math logs

#### Symptom

- Console logs showed correct computed values (`dayIndex`, `top`, `height`), but blocks still appeared clumped in the same corner on screen.
- Drag/resize ghost sometimes appeared absent despite active drag state.

#### Root Cause

- Dynamic geometry values were not consistently applied through inline `style` on rendered elements.
- For this calendar, calculated positioning/sizing values (`top/left/width/height`) must be directly written as inline styles to avoid style-path mismatch and ensure DOM receives final runtime values.

#### Fix

- Moved all calculated geometry for:
  - block items
  - create preview
  - drag/resize ghost
  - now/hover indicators
  to inline `style`.
- Added render-level diagnostics logging actual DOM style and bounding rect values:
  - `[time-blocks-ui] rendered-block-rects`
  - includes style `top/left/width/height` and final `rectX/rectY/rectW/rectH`

#### Validation Improvement

- Added e2e coverage requiring inline geometry style fields and multiple distinct rendered Y positions:
  - `blocks render inline dynamic geometry styles with distinct positions`

## Playwright Spec Challenges

### 1) Data coupling with pre-existing DB rows

#### Symptom

- Specs matched old blocks or failed to find newly created blocks.

#### Why It Happened

- Tests ran against non-ephemeral data.
- Title matching and count-based assumptions were brittle when prior rows existed.

#### Improvement Direction

- Prefer isolated test DB per run or explicit cleanup fixture.
- If isolation is unavailable, rely on robust test IDs + deterministic creation paths and avoid assumptions on global counts/order.

---

### 2) Interaction flakiness from UI state transitions

#### Symptom

- Clicking “Create Block” sometimes failed due unstable/detached elements.
- Closing settings by clicking arbitrary coordinates occasionally triggered unrelated navigation.

#### Why It Happened

- Dialog/state transitions and overlay positioning are sensitive to timing.
- Coordinate clicks are fragile in app shells with sidebars/hot zones.

#### Improvement Direction

- Prefer semantic close actions (`Escape`, explicit close controls).
- Use focused locators and explicit waits around modal transitions.

---

### 3) Overly ambitious assertions for dynamic visual layout

#### Symptom

- Y-position assertions were intermittently unreliable in mixed data/timezone conditions.

#### Why It Happened

- Strong pixel-delta checks can be valid, but become noisy when data visibility depends on window/time range and existing records.

#### Improvement Direction

- Keep interaction assertions tied to explicit test hooks and deterministic UI state.
- Separate “visual layout calibration tests” from “interaction correctness tests.”

## Tooling and Process Gaps

### 1) Need stronger calendar-specific UI test harness

- Add reusable helpers for:
  - opening/closing settings safely
  - forcing deterministic window bounds
  - selecting/creating blocks by stable IDs
- Add a test fixture route or seed utility that guarantees 2-3 known blocks with distinct times.

### 2) Need stricter regression test for reactivity in loop-rendered geometry

- Add a dedicated test:
  - change `Start Hour`/`End Hour`
  - assert at least one known block changes rendered `top`.
- This directly guards the SolidJS stale-geometry regression.

### 3) Need a “known-flaky patterns” section in repo instructions

Recommended additions to AGENTS/docs:

- Avoid coordinate clicks for dismissing overlays in e2e.
- Avoid count-based assertions in persistent/shared databases.
- In Solid, avoid non-reactive layout constants inside `<For>` when values depend on signals.
- For highly dynamic layout values (calendar/drag geometry), avoid class-based/dynamic-class positioning; use inline `style` for computed `top/left/width/height/transform`.

### 4) Add optional e2e mode with ephemeral DB

- Best leverage improvement: one command to run Playwright with isolated database.
- This would remove most data-coupled flake and speed up debugging cycles.

## What Went Well

- Drag interaction bugs were reproducible with Playwright and could be iterated quickly.
- Adding targeted `data-testid` hooks made mouse-flow validation practical.
- Type-check quickly caught a styling key mistake (`pointer-events` vs `pointerEvents` in CSSProperties usage pattern).

## Recommended Next Steps

1. Add an e2e seed/reset helper specifically for time-blocks tests.
2. Add one deterministic reactivity regression spec for Y-position updates after hour-window changes.
3. Add a short “Solid reactive layout in loops” note to engineering docs/AGENTS.
