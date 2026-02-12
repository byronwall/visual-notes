# Conversion Template (Plugin/DOM -> NodeView)

## 1) Old behavior summary

- Extension: `<name>`
- Current file(s):
  - `...`
- Behavior contract:
  - Rendering:
  - Interactions:
  - Attr updates:
  - Selection styling:
  - Side effects:
  - Any modal/popover sidecar UI:

## 2) New NodeView files

- Preferred (co-located): `app/src/components/editor/extensions/<Name>.tsx` contains both:
  - `function <Name>NodeView() { ... }`
  - `export const <Name> = ... addNodeView() ...`
- Optional split only if large/reused:
  - `app/src/components/editor/extensions/<Name>NodeView.tsx`
  - `app/src/components/editor/extensions/<Name>.tsx`

## 3) Wiring changes

- In extension file:
  - import `createSolidNodeViewRenderer`
  - replace `addNodeView()` return with `createSolidNodeViewRenderer(<Name>NodeView)`

## 4) CSS updates

- Keep both cases if needed:
  - direct selected target
  - selected wrapper + inner target

## 4.5) Sidecar UI strategy (modals/popovers)

- Keep NodeView output single-root.
- If the node needs preview/modal UI:
  - add a shared `openXxxPreview(...)` service in `app/src/components/editor/ui/`
  - render modal from stable host (`document.body`) in that service
  - trigger service from node event handlers.

## 5) Validation commands

```bash
cd app
pnpm type-check
```

## 6) Manual verification

- Selection behavior
- Interaction behavior
- Save/reload persistence
- Toolbar/command compatibility

## 7) Cleanup

- Remove superseded code paths
- Remove temporary logs
- Update docs/changelog if behavior intentionally changed
