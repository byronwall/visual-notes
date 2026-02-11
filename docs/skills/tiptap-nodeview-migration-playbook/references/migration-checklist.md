# NodeView Migration Checklist

Use this checklist for each migrated extension.

## Pre-migration

- [ ] Existing behavior contract captured (render, interaction, attrs, selection, side effects).
- [ ] Decision recorded: NodeView vs plugin-level behavior.
- [ ] Existing command and schema dependencies identified.

## Implementation

- [ ] New NodeView component created.
- [ ] Root uses `NodeViewWrapper`.
- [ ] NodeView renders a single stable root (no sibling/fragment roots for sidecar UI).
- [ ] `NodeViewContent` used for non-leaf nodes.
- [ ] Extension `addNodeView()` switched to `createSolidNodeViewRenderer(...)`.
- [ ] Old implementation still present during parity validation (or explicitly superseded).
- [ ] If node interaction opens modal/popover, UI is rendered from an external host/service (not as sibling root inside NodeView).

## Selection/UI parity

- [ ] Node selection visual style still appears correctly.
- [ ] No layout shift from selection styling.
- [ ] Double-click/click/drag behavior parity confirmed.

## Data/commands parity

- [ ] Attr updates persist in doc JSON/HTML.
- [ ] Existing toolbar or command paths still work.
- [ ] Saved output remains compatible with existing documents.

## Integration/regression

- [ ] `pnpm type-check` passes in `app/`.
- [ ] Save/load cycles preserve node behavior.
- [ ] No extra transaction churn/log spam while idle.
- [ ] No orphaned overlay/window listeners remain.

## Cleanup

- [ ] Old overlay/hook/plugin code removed if superseded.
- [ ] Temporary logs removed.
- [ ] Documentation updated if behavior changed intentionally.
