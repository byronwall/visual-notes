---
name: solid-ui-composition-patterns
description: Apply UI composition conventions for Panda, ParkUI wrappers, and shared app primitives. Use when building or refactoring SolidJS UI to keep layout, overlays, and styling consistent.
---

# Solid UI Composition Patterns

Use this skill when working on shared UI structure, wrappers, and styling conventions.

## Core Rules

1. Prefer shared wrappers from `~/components/ui/*` over raw Ark/Park composition in routes.
2. Prefer Panda primitives and tokens.
   - Use `css`, `styled-system/jsx`, and recipes.
   - Avoid raw hex values and ad-hoc spacing unless token is missing.
3. Keep routes route-focused.
   - Reusable UI belongs in `app/src/components/*`, not `app/src/routes/*`.
4. Keep files small and split early (target around 200 LOC when feasible).

## Wrapper and Overlay Rules

1. Prefer `SimplePopover`, `SimpleDialog`, `SimpleModal`, `SimpleSelect` when sufficient.
2. Prefer `PanelPopover` for menu-like title/description overlays.
3. Forward wrapper props (`class`, `style`, etc.) to the effective rendered slot.
4. ParkUI `asChild` is a render function, not a boolean.
5. Import derived ParkUI components with original namespace imports (example: `import * as Popover from "./popover"`).
6. Add derived component names to recipe `jsx` keys.
7. Avoid nested popovers for one interaction flow unless explicitly justified.

## Shared UI Patterns

- Use `ClearButton` and `CloseButton` wrappers instead of bespoke icon-button compositions.
- For clickable icons, always wrap with `IconButton`.
- For search match highlighting, use `renderHighlighted`.
- For hover previews, reuse `DocHoverPreviewLink`, `useDocPreviewMap`, and preview text helpers.
- For floating edge controls, anchor inside a local `position: relative` container with `overflow: visible`; move scrolling to an inner wrapper.
- Keep dynamic list/panel heights stable to prevent layout shift.

## Related Specialized Skills

- TOC/minimap rail bugs: use `toc-rail-layout-playbook`.
- DOM minimization/extraction: use `component-structure-minimal-dom`.
