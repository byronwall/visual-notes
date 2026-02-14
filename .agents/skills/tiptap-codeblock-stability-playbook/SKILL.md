---
name: tiptap-codeblock-stability-playbook
description: Diagnose and fix TipTap code block NodeView instability in this repo, especially cursor jumps, ENTER misplacement, loading freezes, and view/edit rendering conflicts. Use when code block rendering or editing regresses while adding rich viewing features.
---

# TipTap Code Block Stability Playbook

Use this playbook when code block UX changes cause editor instability.

## Use This Skill When

- ENTER in code blocks inserts a newline but cursor jumps to the wrong place.
- Typing in code blocks causes selection jumps or text insertion in unexpected offsets.
- A note route stalls on loading after code block changes.
- A new "fancy viewer" mode works visually but breaks editing behavior.
- NodeView renders correctly in DOM inspector but still behaves incorrectly.

## Do Not Use This For

- Simple theme/color-only syntax highlighting tweaks.
- Non-NodeView markdown rendering outside TipTap editor content.

## Root Causes Seen In This Repo

1. NodeView lifecycle churn:
- Re-mount/destroy cycles during routine text updates can destabilize selection.

2. Wrong renderer hook wiring:
- A default/no-op `setSelection` override in the NodeView renderer can break ProseMirror native selection behavior.

3. Content DOM ownership drift:
- UI that mutates or competes with the editable content DOM subtree can cause cursor jumps.

4. Over-eager reactive updates:
- Re-rendering NodeView props for text-only/decor-only transactions can trigger unnecessary DOM movement.

5. Mixed viewer/editor DOM:
- Rich interactive "view mode" DOM inside the active editable tree can conflict with expected ProseMirror behavior.

## Proven Guardrails

1. Keep editable DOM path minimal.
- For edit mode, use a plain structure:
  - `NodeViewWrapper`
  - non-editable controls (`contentEditable={false}`)
  - `<pre><NodeViewContent as="code" /></pre>`
- Avoid extra wrappers inside `NodeViewContent`.

2. Preserve ProseMirror selection hooks.
- In `createSolidNodeViewRenderer`, only provide `setSelection` when an explicit custom implementation is supplied.
- Do not install a default/no-op `setSelection`.

3. Reduce unnecessary NodeView prop updates.
- Skip update propagation when only code text/decorations changed and attrs requiring rerender did not change.

4. Keep non-edit controls explicitly non-editable.
- Language select, action buttons, copy, and expand controls should set `contentEditable={false}`.

5. Separate view richness from edit reliability.
- Prefer a non-editable "view mode" optimized for display.
- Switch to a plain edit mode for direct code editing reliability.

## Debug Workflow (Order Matters)

1. Confirm baseline without NodeView extras.
- Temporarily reduce code block NodeView to plain select + `<pre><code><NodeViewContent/></code></pre>`.
- Verify ENTER and typing stability first.

2. Instrument only critical boundaries.
- Add temporary logs for:
  - NodeView mount/update/destroy
  - `setSelection`
  - editor transactions around code blocks
  - ENTER keydown state
- Remove noisy logs from render paths after diagnosis.

3. Watch for red flags in logs.
- Frequent mount/destroy during ordinary typing.
- Selection snapping repeatedly to low offsets (for example anchor/head near start).
- Update loops on text-only changes.

4. Re-enable features one at a time.
- Reintroduce controls and styling incrementally.
- Validate after each step before continuing.

5. Validate both modes.
- View mode: collapse behavior, copy, expand affordance, selection for reading.
- Edit mode: stable cursor on typing, ENTER, arrow keys, and click placement.

## Implementation Notes For This Repo

- Primary files:
  - `app/src/components/editor/extensions/CustomCodeBlock.tsx`
  - `app/src/components/editor/nodeviews/createSolidNodeViewRenderer.tsx`
  - `app/src/components/TiptapEditor.tsx` (temporary diagnostics only)
- If route freezes or stays on loading, first disable recent NodeView embellishments and re-add incrementally.
- If debugging requires global viewer UI (modal/drawer), prefer an external host/context over rendering sibling roots inside NodeView.

## Non-Regression Checklist

- ENTER keeps cursor at expected insertion point in code blocks.
- Typing does not teleport cursor when syntax/highlight state changes.
- NodeView does not mount/destroy repeatedly during basic typing.
- Code block route opens without loading stall.
- View mode and edit mode can switch without breaking editing.
- Temporary diagnostic logs are removed before finalizing.
