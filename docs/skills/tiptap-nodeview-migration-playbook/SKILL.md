---
name: tiptap-nodeview-migration-playbook
description: Convert TipTap plugin/overlay-based editor customizations to SolidJS NodeViews in this repo using the local nodeview renderer utilities (no external package). Use when replacing custom ProseMirror DOM hooks, floating overlays, or ad-hoc addNodeView implementations with Solid components.
---

# TipTap NodeView Migration Playbook

Use this playbook when migrating existing TipTap behaviors to in-repo Solid NodeViews.

## Use This Skill When

- You need to replace custom editor overlays with in-node UI.
- You are refactoring TipTap extensions that currently use manual DOM NodeView code.
- You want stateful Solid components as node UI, without adding a third-party integration package.

## Do Not Use This For

- Pure paste/drop transforms that do not represent a specific node UI.
  - Example: CSV/Markdown paste heuristics should usually remain extension/plugin logic.
- Menu-only features (toolbar, bubble menu) that do not belong to node rendering.

## Local NodeView Infrastructure (already in this repo)

- Renderer factory: `app/src/components/editor/nodeviews/createSolidNodeViewRenderer.tsx`
- Context hook: `app/src/components/editor/nodeviews/useSolidNodeView.tsx`
- Wrappers:
  - `app/src/components/editor/nodeviews/NodeViewWrapper.tsx`
  - `app/src/components/editor/nodeviews/NodeViewContent.tsx`

## Migration Strategy

1. Capture behavior contract first.
- List exactly what the old implementation does:
  - render behavior
  - interaction behavior (click/dblclick/drag)
  - selection behavior
  - attribute update behavior
  - keyboard behavior
  - side effects (modals, async actions)
- Keep this list as acceptance criteria.

2. Decide if behavior belongs in NodeView.
- Move to NodeView when UI is node-scoped and position-dependent.
- Keep plugin-level when behavior is document/global interception.

3. Build NodeView component first.
- Prefer co-locating the NodeView component in the same extension file as `addNodeView()` when the component is small and single-use.
  - Preferred: `app/src/components/editor/extensions/MyNode.tsx` contains both component + extension.
  - Split into `*NodeView.tsx` only when the component grows large or is reused.
- Read node state via `useSolidNodeView()`.
- Wrap root with `NodeViewWrapper`.
- If node has editable inner content, include `NodeViewContent` exactly where content should mount.

4. Keep NodeView DOM minimal.
- Use only structural wrappers required for behavior.
- Prefer one root + explicit content area.
- Avoid nested wrappers with no semantic/layout purpose.
- NodeView components must render a stable single root that becomes ProseMirror `dom`.
  - Do not return sibling roots/fragments for mixed concerns (for example, `img` + modal).

5. Wire extension `addNodeView()` to local renderer.
- Return `createSolidNodeViewRenderer(MyNodeView)`.
- Keep extension options/attrs unchanged until behavior parity is confirmed.

6. Migrate interactions incrementally.
- Port one behavior at a time (selection, click actions, attribute updates, etc.).
- After each behavior, validate manually before deleting old logic.

7. Move external overlays into node controls (when appropriate).
- If overlay is only relevant while selection is in a specific node type, prefer embedding controls in NodeView.
- Remove view-position math and window-level listeners once replaced.
- Exception for global/floating UI (modals/popovers not structurally part of node):
  - Trigger them from NodeView events, but render them from a stable external host/service.
  - This avoids reconciliation issues when ProseMirror owns/moves the NodeView root DOM.

8. Preserve editor contracts.
- Existing commands, toolbar actions, and saved HTML schema must remain compatible unless explicitly changing format.
- If changing attrs/schema, document migration impact.

9. Remove dead code after parity.
- Delete old custom DOM hooks, overlay utilities, and unused event listeners.
- Remove temporary logs unless explicitly requested.

## Implementation Pattern

### A) NodeView component skeleton

```tsx
import { createMemo } from "solid-js";
import { NodeViewWrapper, NodeViewContent, useSolidNodeView } from "../nodeviews";

export function MyNodeView() {
  const { state } = useSolidNodeView<{ foo?: string }>();
  const foo = createMemo(() => String(state().node.attrs.foo || ""));

  return (
    <NodeViewWrapper class="my-node" data-node-kind="my-node">
      <div>{foo()}</div>
      <NodeViewContent as="div" class="my-node-content" />
    </NodeViewWrapper>
  );
}
```

### B) Extension wiring

```ts
import { createSolidNodeViewRenderer } from "../nodeviews";
import { MyNodeView } from "./MyNodeView";

addNodeView() {
  return createSolidNodeViewRenderer(MyNodeView);
}
```

## Selection and Styling Rules

- Node selection class lands on NodeView root (`.ProseMirror-selectednode`).
- If visual ring should appear on an inner element (like `img`), add CSS for both:
  - direct selected node target
  - selected wrapper + inner target
- Keep selection styles non-layout-shifting (outline/outline-offset preferred).

## Attribute Updates and Node Commands

Inside NodeView, update attrs using state helper:

- `state().updateAttributes({ key: value })`

Delete current node via:

- `state().deleteNode()`

When using toolbar/commands externally, preserve existing chain command behavior.

## Drag and ContentDOM Notes

- `NodeViewWrapper` wires `onDragStart` from renderer context.
- For non-leaf nodes, `NodeViewContent` is required to mount ProseMirror-managed content.
- For leaf nodes (image-like), do not include `NodeViewContent`.
- For semantic container nodes (`tr`, `th`, `td`) prefer renderer option `useDomAsContentDOM: true` and use the wrapper root as content DOM.
  - This avoids invalid intermediary elements (for example `div` under `tr`) and preserves valid table markup.

## SSR/Hydration Safety

When converting server-rendered editor containers:

- Keep NodeView logic browser-safe (no unconditional DOM global calls at module scope).
- Keep interactions event-driven or in lifecycle hooks.
- Avoid branching that changes node DOM structure between server and client unexpectedly.

## Verification Workflow

1. Run type checks.
- `cd app && pnpm type-check`

2. Manual parity checks.
- Node renders correctly.
- Node selection class and visual state are correct.
- Interactions from old implementation still work.
- Attr updates persist in document and survive save/reload.
- Copy/paste and drag behaviors still work for that node.

3. Regression checks around editor integration.
- Toolbar actions still function.
- AI/selection context extraction still works where relevant.
- No continuous layout/transaction churn introduced.

Use `references/migration-checklist.md` as the detailed pass/fail sheet.

## Common Failure Modes

- Missing `NodeViewWrapper` root marker causes renderer contract breakage.
- Forgetting `NodeViewContent` for non-leaf nodes breaks editable child content.
- Using a non-semantic wrapper root that invalidates parent-child DOM structure (for example, `div` wrapping `th`/`td` inside `tr`).
- Returning multiple roots from a NodeView component and mounting sidecar UI as siblings (can trigger `insertBefore ... node is not a child` during reactive updates).
- Styling only `img.ProseMirror-selectednode` after moving to wrapper-based NodeView.
- Leaving old overlay listeners active after moving controls into NodeView.
- Changing attrs names without updating command paths and persisted content expectations.

## Debug Signature: `insertBefore` NotFoundError

If you see:

- `NotFoundError: Failed to execute 'insertBefore' on 'Node'...`
- stack traces in Solid `reconcileArrays` / `insertExpression`

Check for NodeViews rendering multiple sibling roots or fragment children. Fix by:

1. Keeping NodeView output to a single root (`NodeViewWrapper` root).
2. Moving modal/popover UI to an external service host.
3. Triggering that service from NodeView events (`onClick`/`onDblClick`) instead of rendering modal inside NodeView tree.

## Repo-Specific Conventions

- Keep component files around ~200 LOC when feasible.
- Prefer named exports.
- No prop destructuring for reactive props.
- Use `Show`/`Switch` for conditional rendering.
- Use Panda/UI tokens for styles; avoid ad-hoc utility strings.

## Recommended Rollout Order

1. Leaf nodes first (image-like) to validate renderer pattern.
2. Node-scoped overlays next (e.g., code block controls).
3. Complex content nodes with `NodeViewContent` last.

## References

- Migration checklist: `references/migration-checklist.md`
- Conversion template: `references/conversion-template.md`
