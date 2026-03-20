# Editor NodeView Regression Work Summary (2026-03-20)

## 1) Scope and Context

- Request:
  Diagnose and fix regressions in the document editor/viewer at `/docs/cmlvsagq6000i8cgl6dw1qlke`, then document what went wrong in detail.
- Areas changed:
  - `app/src/components/editor/extensions/CustomCodeBlock.tsx`
  - `app/src/components/editor/extensions/CustomImage.tsx`
- User-visible symptoms:
  - Code block language pickers, copy buttons, and expand buttons were appearing in the wrong place.
  - Code block line numbers no longer lined up with rendered code lines.
  - Image selection no longer showed a visible outline, which made the selection/edit affordance feel broken.
- Constraints:
  - Fixes needed to be verified in the live browser, not inferred from source alone.
  - The app route was behind the local magic-password login gate, so browser work required authenticating first.
  - The goal was a focused repair, not a broad editor refactor.

## 2) Major Changes Delivered

- Re-anchored code block UI to each code block node view in `app/src/components/editor/extensions/CustomCodeBlock.tsx`.
  - Added explicit local layout classes for the code block wrapper, `pre`, code content, gutter, and line-number rows.
  - Result:
    code block controls now anchor to the correct block rather than floating relative to the editor root.
- Reintroduced reactive image selection affordances in `app/src/components/editor/extensions/CustomImage.tsx`.
  - Added explicit local layout classes for the image node wrapper and image element.
  - Added memoized reactive style bindings for selection chrome, image controls, and resize handles.
  - Result:
    clicking an image visibly selects it again and reveals the inline image controls.
- Fixed line-number alignment drift in `app/src/components/editor/extensions/CustomCodeBlock.tsx`.
  - Removed a stale gutter transform and padding shim that were pulling the number column upward by roughly one content padding step.
  - Result:
    the first line number and first rendered code line now share the same top position.
- Intentionally unchanged:
  - No changes were made to the shared `document-content-styles.ts` rules beyond investigation.
  - No changes were made to editor schema, TipTap extension ordering, or syntax-highlighting behavior.

## 3) Design Decisions and Tradeoffs

- Decision:
  Move critical nodeview presentation logic into the nodeview components themselves.
  - Alternatives considered:
    - Fix the shared `document-content-styles.ts` selector strategy.
    - Try to debug Panda/style emission for the shared prose container first.
  - Why chosen:
    - Browser inspection showed the nodeview roots were still `position: static` even though shared descendant rules existed in source.
    - The fastest safe repair was to make the affected nodeviews self-sufficient instead of depending on shared container selectors that were not taking effect for these editable nodeview roots.
  - Tradeoff:
    - Some layout rules are now duplicated between shared prose styling and nodeview-local styling.
    - The benefit is higher confidence that nodeview-specific interaction surfaces stay stable even if shared prose selectors regress again.

- Decision:
  Use reactive style memos for image selection affordances instead of relying only on external CSS selectors.
  - Alternatives considered:
    - Keep selection styling purely in `document-content-styles.ts`.
    - Style only the `.ProseMirror-selectednode` class and not the nodeview’s `data-selected` state.
  - Why chosen:
    - Browser verification showed TipTap selection state was updating, but the image outline and controls were not repainting correctly from the old styling path.
    - Binding the style directly to `state().selected` and `resizing()` made the behavior explicit and removed dependence on stale external selector application.
  - Tradeoff:
    - The image node view now owns more of its visual state.
    - The benefit is that selection feedback now follows the actual nodeview state reliably.

- Decision:
  Remove the gutter transform rather than trying to counterbalance it elsewhere.
  - Alternatives considered:
    - Change content padding to match the old gutter transform.
    - Add a different line-height fudge factor.
  - Why chosen:
    - Browser measurements showed the code content’s first rendered line started 12px below the content box top, while the gutter had been manually translated upward by approximately that same amount.
    - The clean fix was to stop offsetting the gutter and let both columns start from the same top inset.
  - Tradeoff:
    - None meaningful; this removed a stale hack rather than replacing it with another hack.

## 4) Problems Encountered and Resolutions

- Problem:
  Code block controls for multiple blocks all rendered near the top of the editor.
  - Symptom:
    different code blocks shared the same overlay position in the browser.
  - Root cause:
    the code block wrapper was effectively `position: static`, so absolutely positioned controls anchored to the editor container instead of the node view wrapper.
  - Resolution:
    added explicit `position: "relative"` and related layout styling directly in `CustomCodeBlock.tsx`.
  - Preventative action:
    for custom nodeviews with floating controls, prefer component-local structural styles for the positioning context rather than relying exclusively on shared prose descendant selectors.

- Problem:
  Image selection looked broken.
  - Symptom:
    clicking an image changed the node selection state but did not show a visible outline, and the inline controls stayed hidden.
  - Root cause:
    selection state changed, but the old visual affordance path was not reliably repainting from shared CSS alone.
  - Resolution:
    added memoized reactive styles to the image element, control strip, and resize handles in `CustomImage.tsx`.
  - Preventative action:
    for nodeview affordances that depend on selection state, prefer wiring visibility and highlight state directly to nodeview state where possible.

- Problem:
  Code line numbers did not line up with the rendered code lines.
  - Symptom:
    line numbers started above the first rendered code line in the indented-code example.
  - Root cause:
    the gutter still had a legacy `transform: translateY(-12px)` plus extra padding from an older spacing scheme, while the code content now used a clean 12px top padding.
  - Resolution:
    removed the gutter transform and extra top padding from the local gutter class in `CustomCodeBlock.tsx`.
  - Preventative action:
    avoid keeping manual pixel-offset shims once the surrounding layout model changes; re-measure the live DOM after layout refactors instead of preserving old compensations.

- Problem:
  Shared prose rules existed in source, but were not sufficient to stabilize these nodeview surfaces.
  - Symptom:
    source inspection suggested the wrappers should already be `position: relative`, but computed browser styles showed otherwise.
  - Root cause:
    the nodeview interaction surfaces were effectively depending on styling behavior that was not reliably applied in the editable nodeview context.
  - Resolution:
    stopped treating shared prose descendant rules as authoritative for these interactive nodeviews and moved critical layout/state styling into the extensions themselves.
  - Preventative action:
    when browser-computed styles contradict source expectations, trust the browser and repair the effective styling path rather than the intended path.

## 5) Verification and Validation

- Commands run:
  - `pnpm --dir app type-check`
    - Result: passed after the final fixes.
  - `pnpm --dir app lint`
    - Result: completed earlier in the session with repo-wide pre-existing warnings only; no new lint errors were introduced by this work.
- Manual browser checks:
  - Authenticated through the local login gate and opened `http://[::1]:3000/docs/cmlvsagq6000i8cgl6dw1qlke`.
  - Verified code block controls now anchor to the correct block.
  - Verified image click reveals the inline image control cluster and visible selection ring.
  - Verified the first line number and first rendered code line now share the same top coordinate.
- Notable measurements:
  - Before line-number fix:
    - first code line top: `1943.6015625`
    - first number top: `1933.6015625`
  - After line-number fix:
    - first code line top: `1943.6015625`
    - first number top: `1943.6015625`
- Evidence captured:
  - Before broad regression fix:
    - `/Users/byronwall/Projects/visual-notes/tmp/editor-before-full.png`
  - After control anchoring/image fixes:
    - `/Users/byronwall/Projects/visual-notes/tmp/editor-after-full.png`
  - After image selection fix:
    - `/Users/byronwall/Projects/visual-notes/tmp/editor-after-image-selected.png`
  - After code-line alignment fix:
    - `/Users/byronwall/Projects/visual-notes/tmp/code-line-alignment-fixed.png`
- Validation gaps:
  - No automated Playwright test was added in this session.
  - Shared prose styling behavior outside the touched code/image nodeviews was not exhaustively audited.

## 6) Process Improvements

- Improvement:
  use live geometry checks earlier for editor regressions.
  - Current pain/problem:
    source review alone did not reveal that overlays were anchoring to the wrong offset parent or that the gutter still had a stale transform.
  - Proposed change:
    for editor-nodeview regressions, standardize a quick Playwright geometry pass that logs `getBoundingClientRect()` for wrapper, controls, and first content row before editing.
  - Expected benefit:
    faster isolation of the real layout delta and less time spent reasoning from stale source assumptions.
  - Suggested owner/place to encode:
    `improve-via-playwright` skill.

- Improvement:
  document the “computed styles win over source intent” rule for nodeview debugging.
  - Current pain/problem:
    the codebase contained descendant rules that looked correct on inspection, which could have sent the investigation down the wrong path.
  - Proposed change:
    add a short checklist item for nodeview debugging: always compare source selectors against computed `position`, `visibility`, and offset parent in the live browser.
  - Expected benefit:
    less churn when shared styling and effective styling diverge.
  - Suggested owner/place to encode:
    `AGENTS.md` editor/debugging guidance or the `improve-via-playwright` skill.

## 7) Agent/Skill Improvements

- Missing instruction discovered:
  the repo guidance strongly recommends Playwright verification for editor/popover/interaction work, but it does not explicitly call out nodeview geometry inspection as a first-class debugging pattern.
  - Proposed update:
    add a small “TipTap nodeview debugging” note to `AGENTS.md` or a dedicated skill note:
    - inspect offset parent
    - inspect computed `position`
    - compare wrapper top, control top, and first content row top
    - distrust old transform/padding shims during layout repairs
  - Why this would reduce future iteration churn:
    it would shorten time-to-root-cause for regressions involving inline editor affordances and floating nodeview controls.

- Missing instruction discovered:
  post-work documentation benefits from explicitly recording before/after measured coordinates, not just screenshots, when the bug is layout drift.
  - Proposed update:
    extend `post-work-doc-playbook` examples to mention numeric DOM measurements for UI-layout regressions.
  - Why this would reduce future iteration churn:
    future maintainers can verify whether a later change reintroduces the same drift without relying only on screenshots.

## 8) Follow-ups and Open Risks

- High priority:
  audit whether other custom TipTap nodeviews still depend on shared prose descendant rules for critical positioning or selection affordances.
- Medium priority:
  consider adding an automated Playwright smoke test for this document that verifies:
  - code block controls open in-place
  - image click shows selection affordance
  - first line number and first code line share the same top coordinate
- Medium priority:
  decide whether `document-content-styles.ts` should keep duplicate nodeview-related rules now that the nodeviews are self-styled. The current state is safe, but some duplication remains.
- Residual risk:
  if shared prose styling behavior changes again, these two nodeviews should remain stable, but other nodeviews that still depend on the shared path may regress independently.
