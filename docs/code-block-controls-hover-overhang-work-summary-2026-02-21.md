# Code Block Controls Hover/Overhang Work Summary (2026-02-21)

## 1. Scope and context

This work refined editor code block controls so they are less noisy at idle but always accessible.

Requested outcomes:
- Hide extra code block controls until hover.
- Keep controls visible while hovering the controls themselves.
- Place controls at top-right with partial top overhang.
- Keep copy control usable in collapsed code blocks.
- Improve line-number to code-content spacing.

Primary implementation files:
- `app/src/components/editor/extensions/CustomCodeBlock.tsx`
- `app/src/components/TiptapEditor.tsx`

## 2. Major changes delivered

- Added hover-gated visibility for code block controls.
  - Controls default to hidden (`opacity: 0`, `visibility: hidden`, `pointer-events: none`).
  - Controls show when the code block wrapper is hovered/focused.
- Reworked code block structure to prevent collapsed-scroll clipping of overhanging controls.
  - NodeView root changed from `pre.vn-codeblock` to `div.vn-codeblock-wrap`.
  - `pre.vn-codeblock` moved inside that wrapper.
  - Controls are now absolutely positioned relative to wrapper, not the scrollable `pre`.
- Kept controls consistently top-right with slight overhang.
  - `top="-2"` and `right="2"` on controls container.
- Increased spacing between line numbers and first code characters.
  - `editableGutterPadding` changed to `calc(<digits>ch + 2.5rem)`.

## 3. Design decisions and tradeoffs

- Decision: split positioning container from scrolling container.
  - Why: collapsed `pre` uses `overflow: auto`; anything overhanging from that element gets clipped.
  - Tradeoff: slightly more DOM depth (`wrapper + pre`), but predictable overlay behavior in both collapsed and expanded modes.
- Decision: drive control reveal by wrapper hover/focus.
  - Why: controls should appear for either hovering the block or directly interacting with the controls.
  - Tradeoff: CSS selectors became wrapper-based instead of `pre`-based, but behavior is now stable.

## 4. Problems encountered and resolutions

- Runtime `ReferenceError: Cannot access 'isCollapsible' before initialization`.
  - Cause: memo used before declaration.
  - Resolution: moved `isCollapsible` declaration above dependent memo logic.
- Runtime `ReferenceError: Cannot access 'collapsed' before initialization`.
  - Cause: memo referenced `collapsed` accessor before accessor definition.
  - Resolution: moved dependent memo below `collapsed` accessor declarations.
- Collapsed controls appeared stuck/high.
  - Cause: transient bad negative top value and, more fundamentally, controls anchored to an element that became a scroll container.
  - Resolution: removed state-based vertical hacks and anchored controls to wrapper with fixed top overhang.

## 5. Verification and validation

Manual verification through iterative UI screenshots/user confirmation:
- Controls now render in the desired overhanging top-right position.
- Hover behavior works without idle clutter.
- Final user confirmation: “That is now perfect.”

Commands used during implementation:
- `rg -n "code block|codeblock|CodeBlock|..."`
- `sed -n ... app/src/components/editor/extensions/CustomCodeBlock.tsx`
- `sed -n ... app/src/components/TiptapEditor.tsx`
- `git diff -- app/src/components/editor/extensions/CustomCodeBlock.tsx app/src/components/TiptapEditor.tsx`

Validation caveat:
- `pnpm run lint` in `app/` failed in this environment because ESLint v9 could not locate an `eslint.config.*` file via the invoked command path.

## 6. Process improvements

- For floating controls that must overhang while content can scroll:
  - Use an outer `position: relative; overflow: visible` anchor.
  - Put scroll behavior on an inner container.
  - Attach hover/focus selectors to the outer anchor.

## 7. Agent/system prompt or skill improvements

- Proposed addition to local guidance (if desired):
  - In editor NodeView overlay patterns, prefer “outer anchor + inner scroller” by default when a control must remain visible/interactive across collapsed and expanded states.

## 8. Follow-ups and open risks

- Follow-up: run the project-standard lint/type-check path once ESLint config resolution is confirmed in this environment.
- Risk: low. The behavior now matches requested UX, but additional visual QA on narrow/mobile widths is still recommended.
