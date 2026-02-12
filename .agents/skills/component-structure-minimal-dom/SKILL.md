---
name: component-structure-minimal-dom
description: Design or refactor SolidJS UI components to use the fewest DOM elements necessary while preserving accessibility, predictable overflow behavior, and composability with shared structural primitives. Use when extracting repeated UI patterns, reducing wrapper depth, or fixing layout issues caused by unconstrained descendants.
---

# Component Structure Minimal DOM

Use this skill when UI work needs cleaner composition and fewer DOM nodes.

## Goals

- Minimize unnecessary wrapper elements.
- Keep layout predictable at all breakpoints.
- Prefer reusable structural primitives and shared wrappers.
- Preserve accessibility and interaction semantics.

## Rules

1. Start by mapping required behavior before changing structure.
   - Identify which elements are required for semantics (button, list item, form field, heading).
   - Identify which elements are required for layout constraints (width/height bounds).
   - Identify which elements are required for overflow behavior (scroll viewport).
2. Remove or merge wrappers that do not provide unique semantics or layout responsibility.
3. Prefer structural primitives (`Box`, `Stack`, `HStack`, `Flex`) over ad-hoc nested `div` trees.
4. Reuse shared UI wrappers when available.
   - `ClearButton` for clear icon actions.
   - `CloseButton` for close icon actions.
   - `SimpleDialog` footer for persistent actions.
5. Keep action rows stable.
   - In dialogs, place persistent controls in footer when content can scroll.
   - Do not let long content push action controls out of view.
6. Separate overflow responsibilities explicitly.
   - Constraint container: `w="full"`, `maxW="100%"`, `minW="0"`, `overflow="hidden"`.
   - Scroll container: `overflowX`/`overflowY` as needed.
   - Content container: intrinsic sizing only when needed.
7. Avoid intrinsic sizing that escapes container bounds unless it is isolated inside a scroll viewport.
   - Be careful with `min-width: fit-content`.
   - Prefer explicit width constraints on ancestors first.

## Refactor Workflow

1. Inspect the repeated pattern and list which props/labels vary.
2. Extract the smallest reusable component/hook that captures shared behavior.
3. Migrate at least two call sites to validate API shape.
4. Ensure call sites become simpler after extraction.
5. Verify overflow behavior with long unbroken content.
6. Run `pnpm type-check` in `app/`.

## Verification Checklist

- No redundant wrapper elements remain around the refactored region.
- Layout constraints are explicit (`minW`, `maxW`, `w`) where needed.
- Overflow happens only in the intended viewport.
- Buttons/critical actions remain visible when content is long.
- Accessibility labels are present for icon-only actions.
- Types pass (`pnpm type-check`).
