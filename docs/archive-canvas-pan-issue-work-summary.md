# Archive Canvas Pan Issue Work Summary

## 1) Scope and Context

- Requested work:
  Investigate why the Explorer archive canvas page on prod had effectively dead mouse interaction, then fix the issue in the dev codebase.
- Area changed:
  Archive canvas interaction behavior in `/archive/groups/[group]/canvas`, specifically background panning and archive card hover chrome.
- Constraints:
  The exact prod dataset was not available locally, so diagnosis used the prod site for reproduction and the local dev app for implementation and verification on a comparable archive group. The page mixes HTML card surfaces with a transformed HTML canvas layer, while the main `/canvas` route uses SVG transforms and already worked correctly.

## 2) Major Changes Delivered

- Fixed archive canvas transform application in [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx).
  Behavior impact:
  Background drag now moves the archive canvas view because the transform layer receives a CSS-valid transform string with `px` translation units.
- Restored dead-space interaction by making the transform layer pointer-transparent and re-enabling pointer events only on card wrappers in [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx).
  Behavior impact:
  Empty canvas background can receive pan gestures without card overlays swallowing the hit target.
- Added a background mouse-pan fallback on the archive canvas viewport in [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx).
  Behavior impact:
  Desktop mouse dragging from blank canvas space updates archive canvas offset even when card content is not the interaction target.
- Moved archive card chrome back inside the card bounds in [ArchiveCanvasCard.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveCanvasCard.tsx) and [ArchiveCanvasFreeformCard.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveCanvasFreeformCard.tsx).
  Behavior impact:
  Hover chrome no longer spills into the route toolbar area, reducing dead-looking controls and overlapping hit zones.
- Intentionally unchanged:
  The main `/canvas` route and shared `createCanvasStore()` behavior were not modified because Playwright showed that route already pans correctly.

## 3) Design Decisions and Tradeoffs

- Decision:
  Fix the archive canvas layer locally instead of changing the shared `viewTransform()` helper in [canvas.store.ts](/Users/byronwall/Projects/visual-notes/app/src/stores/canvas.store.ts).
  Alternatives considered:
  Rewriting the shared store transform format or changing the main canvas route to match archive behavior.
  Why chosen:
  The main `/canvas` route uses SVG and already handled the existing transform string correctly. The bug was specific to the archive canvas applying that same string to an HTML `div`.
  Tradeoffs accepted:
  Archive canvas now computes its own CSS transform string instead of fully reusing the shared derived string.

- Decision:
  Keep the background mouse-pan fallback in [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx).
  Alternatives considered:
  Rely only on the shared pointer-based pan handler.
  Why chosen:
  The archive canvas page is interaction-dense and mixes pointer handlers with cards, note editors, and resize handles. The mouse fallback gives a robust path for desktop dragging from dead space.
  Tradeoffs accepted:
  Archive canvas has a little more route-specific interaction code than the main canvas.

- Decision:
  Move hover chrome inside card bounds rather than keeping it above the card.
  Alternatives considered:
  Preserve the negative top offset and try to fix only z-index or pointer-events behavior.
  Why chosen:
  The chrome was rendering into the page action bar region on affected canvases, which made controls appear present but unreachable.
  Tradeoffs accepted:
  The chrome sits slightly lower visually than before.

## 4) Problems Encountered and Resolutions

- Problem:
  Prod Explorer archive canvas looked dead when dragging blank space.
  Root cause:
  The archive transform layer was styled with a transform string like `translate(x, y) scale(s)`, which is accepted by SVG but was not being interpreted as a translating CSS transform on the HTML layer. Browser computed style kept the scale but dropped translation.
  Resolution:
  Updated [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx) to emit `translate(${offset.x}px, ${offset.y}px) scale(${scale})`.
  Preventative action:
  When sharing transform helpers between SVG and HTML surfaces, verify computed transform matrices in the browser rather than trusting the raw string.

- Problem:
  Dragging dead space still felt blocked during investigation even after pointer events were firing.
  Root cause:
  The transform layer covered the viewport and needed to be transparent to hit testing so the viewport could consistently own the background interaction path.
  Resolution:
  Set the transform layer to `pointerEvents="none"` and explicitly opted card wrappers back into `pointerEvents="auto"` in [ArchiveGroupCanvas.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveGroupCanvas.tsx).
  Preventative action:
  For transformed HTML canvas-like layers, default the container to pointer-transparent and let interactive children opt in.

- Problem:
  Archive card hover chrome appeared visually but could overlap unrelated page controls.
  Root cause:
  The chrome was absolutely positioned above the card with `top: -34px`, which let it escape into the route toolbar zone.
  Resolution:
  Moved the chrome inside the card in [ArchiveCanvasCard.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveCanvasCard.tsx) and [ArchiveCanvasFreeformCard.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/archive/ArchiveCanvasFreeformCard.tsx).
  Preventative action:
  Verify overlay/control placement on transformed card surfaces against nearby page-level controls, not just against the card itself.

- Problem:
  Initial diagnosis was confusing because logs showed transform updates while the page still looked visually static.
  Root cause:
  The raw logged string changed, but the browser-computed matrix showed translation terms staying at zero before the CSS transform fix.
  Resolution:
  Added temporary console logs and used Playwright to compare inline transform strings, computed matrices, and on-screen card positions before and after drag. The logs were removed after confirmation.
  Preventative action:
  For visual transform bugs, inspect computed matrices and screen positions in addition to app state logs.

## 5) Verification and Validation

- Command run:
  `cd app && pnpm type-check`
  Result:
  Passed.
- Manual / Playwright checks performed:
  Reproduced the prod issue on `https://notes.apps.byroni.us/archive/groups/shadcn/canvas`.
- Manual / Playwright checks performed:
  Reproduced the archive canvas interaction locally on `http://[::1]:3000/archive/groups/shadcn%202026-03-18%2002%3A16/canvas`.
- Manual / Playwright checks performed:
  Confirmed archive drag generated changing computed CSS matrices on the HTML transform layer.
  Evidence:
  Before drag computed transform was `matrix(0.360321, 0, 0, 0.360321, 209.594, 424.259)`.
  After drag computed transform was `matrix(0.360321, 0, 0, 0.360321, -17.7398, 424.259)`.
- Manual / Playwright checks performed:
  Confirmed visible content moved on screen during dead-space drag.
  Evidence:
  A visible page-card title moved from `x: 520.08` to `x: 292.75` after a leftward background drag.
- Gaps:
  `pnpm lint` was not run because the fix was tightly scoped and `pnpm type-check` covered the touched TypeScript paths.
- Gaps:
  Prod was not directly patched or re-verified after deployment because the requested workflow was to fix dev code for a later user push.

## 6) Process Improvements

- Improvement:
  Compare the broken route against a known-good sibling route that uses the same shared hook.
  Current pain:
  It was easy to overfocus on pointer events even though the main failure was transform interpretation.
  Proposed change:
  Make “find the nearest working route using the same primitive” a standard debugging step for UI regressions.
  Expected benefit:
  Faster separation of shared-hook bugs from route-specific integration bugs.
  Suggested encoding:
  Add to AGENTS debugging guidance for UI interaction regressions.

- Improvement:
  Verify browser-computed transforms, not just logged state values.
  Current pain:
  State logs suggested panning was working long before the page visibly moved.
  Proposed change:
  Add a standard verification step that inspects `getComputedStyle(...).transform` and one visible element’s bounding box before/after the interaction.
  Expected benefit:
  Faster detection of CSS/SVG transform mismatches.
  Suggested encoding:
  Add to the `improve-via-playwright` skill as a recommended check for transform/layout bugs.

## 7) Agent/Skill Improvements

- Missing instruction discovered:
  The current browser-debug workflow does not explicitly remind the agent to distinguish SVG transform syntax from CSS transform syntax when a shared helper is reused across rendering layers.
  Proposed update:
  Add a short note to the `improve-via-playwright` skill that transform bugs on HTML layers should be validated with computed matrices and unit-bearing CSS transforms.
  Why this would reduce future iteration churn:
  It would have shortened the path from “state changes but visuals do not” to the actual root cause.
  Suggested encoding:
  `/Users/byronwall/Projects/visual-notes/.agents/skills/improve-via-playwright/SKILL.md`

- Missing instruction discovered:
  The repo guidance does not currently call out the risk of sharing transform helpers between SVG and HTML render targets.
  Proposed update:
  Add a short AGENTS note that HTML geometry layers must use CSS-valid transform strings with units, while SVG can use attribute-style transforms.
  Why this would reduce future iteration churn:
  It would prevent the same mistake when adding more archive or editor canvases.
  Suggested encoding:
  Repo `AGENTS.md`

## 8) Follow-ups and Open Risks

- Follow-up:
  Consider removing the archive-specific background mouse-pan fallback if the shared pointer-only path is later simplified and proven robust enough on this route.
  Priority:
  Medium.
- Follow-up:
  Run a broader Playwright smoke pass on archive canvas interactions after deployment, including card drag, resize handles, note editing, and detail drawer open/close.
  Priority:
  Medium.
- Known limitation:
  This work fixed the archive canvas HTML transform path only. It did not refactor shared transform generation across HTML and SVG surfaces.
- Residual risk:
  Other HTML surfaces may still be reusing SVG-style transform strings if they copied the archive pattern independently.
