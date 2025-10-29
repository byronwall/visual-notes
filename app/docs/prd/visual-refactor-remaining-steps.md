## Visualization Refactor — Remaining Steps for Handoff

This document describes the remaining work to finish the visualization refactor. Steps 1–3 are already complete and live in the codebase. The tasks below are scoped so a fresh agent can continue with minimal context switching.

### What’s already done

- **Step 1 (Types + Services)**: Extracted domain types and data fetchers.
  - `app/src/types/notes.ts`: `DocItem`, `UmapPoint`, `UmapRun`.
  - `app/src/services/docs.service.ts`: `fetchDocs`, `fetchLatestUmapRun`, `fetchUmapPoints`.
- **Step 2 (Resources)**: Wrapped data fetching in Solid resources.
  - `app/src/services/docs.resources.ts`: `useDocsResource`, `useUmapRunResource`, `useUmapPointsResource`.
- **Step 3 (Pure utils/layout/spatial)**: Extracted pure logic modules and updated the route to use them.
  - `app/src/utils/hash.ts`, `app/src/utils/colors.ts`, `app/src/utils/geom.ts`.
  - `app/src/layout/seeded.ts` (seed-based initial positions), `app/src/layout/umap-normalize.ts` (UMAP normalization).
  - `app/src/spatial/kdtree.ts` (KD-tree build + nearest).
  - `app/src/routes/visual.tsx` imports these modules and no longer contains inline versions.

### Guardrails and conventions

- **TypeScript**: Project `strict` mode is enabled. Avoid `any` unless absolutely required; if used, add a concise rationale in code comments.
- **Imports**: Use top-level imports, path alias `~/` maps to `app/src/*`.
- **Event handlers**: Prefer `const handlerName = () => { ... }` and then `onClick={handlerName}`.
- **Debug logs**: Use `console.log` sparingly but intentionally at key control-flow points.
- **Prisma**: Not relevant here; do not touch the Prisma schema for this refactor.

---

## Step 4 — Create granular stores (state layer)

Status: Completed (2025-10-29)

Implemented

- `app/src/stores/canvas.store.ts`
- `app/src/stores/positions.store.ts`
- `app/src/routes/visual.tsx` updated to instantiate and use the stores

Create two stores to separate UI/canvas state from data/layout state.

### 4.1 `app/src/stores/canvas.store.ts`

- Export `createCanvasStore()` returning the UI state and actions.
- Signals/state:
  - `scale: () => number`, `setScale: (n: number) => void`
  - `offset: () => { x: number; y: number }`, `setOffset: (t: { x: number; y: number }) => void`
  - `navHeight: () => number`, `setNavHeight: (n: number) => void`
  - `isPanning: () => boolean`, `setIsPanning: (b: boolean) => void`
  - `mouseScreen: () => { x: number; y: number }`, `setMouseScreen: (p: { x: number; y: number }) => void`
  - `useUmap: () => boolean`, `setUseUmap: (b: boolean) => void`
  - `viewTransform: () => string` (memo: `translate(tx, ty) scale(s)`).
- Methods/helpers:
  - `scheduleTransform(): void` (requestAnimationFrame gate; matches existing behavior).
  - `fitToSpread(): void` (uses window inner size + `navHeight` to set initial zoom/center).
- Implementation notes:
  - Port existing logic from `app/src/routes/visual.tsx` (pan/zoom/view transform, nav measurement). Keep console logs minimal and useful.

### 4.2 `app/src/stores/positions.store.ts`

- Export `createPositionsStore(deps)` where `deps` contains:
  - `docs: Accessor<DocItem[] | undefined>`
  - `umapRun: Accessor<UmapRun | undefined>` (if needed later)
  - `umapPoints: Accessor<UmapPoint[] | undefined>`
  - `useUmap: Accessor<boolean>`
- Signals/memos:
  - `umapIndex: () => Map<string, { x: number; y: number }>` via `normalizeUmap(umapPoints(), SPREAD)`.
  - `basePositions: () => Map<string, { x: number; y: number }>` picks UMAP point when `useUmap()` and available; otherwise seeded via `seededPositionFor(title, index, SPREAD)`.
  - `adjustments: () => Map<string, { x: number; y: number }>` and `setAdjustments`.
  - `positions: () => Map<string, { x: number; y: number }>` merges base + adjustments.
  - `kdTree: () => KDNode | undefined` using `buildKdTree` from `positions()`.
  - `layoutVersion: () => number`, `setLayoutVersion` for any bumping needed.
  - `nudging: () => boolean`, `setNudging`.
- Methods:
  - `runNudge: (iterations?: number) => Promise<void>` — will call pure `nudgePositions` in Step 6 and then update `adjustments`.
- Implementation notes:
  - Keep this store free of DOM logic. It should depend only on the resource accessors and pure utils.

### 4.3 Update the route to instantiate stores

- In `app/src/routes/visual.tsx`:
  - Import `createCanvasStore` and `createPositionsStore`.
  - Instantiate: `const canvasStore = createCanvasStore()` and `const positionsStore = createPositionsStore({ docs: docs, umapRun, umapPoints, useUmap: canvasStore.useUmap })`.
  - Replace direct uses of local signals with calls to the stores (e.g., `scale()` becomes `canvasStore.scale()`).
  - Replace `umapIndex`, `basePositions`, `positions`, `kdTree`, `nudging` with `positionsStore` members.

### Acceptance criteria (Step 4)

- Route compiles and runs with stores.
- No behavioral regressions (pan/zoom, hover, rendering, nudge button still calls a placeholder `positionsStore.runNudge`).
- Lints clean.

---

## Step 5 — Extract interaction logic into hooks (interaction layer)

Status: Completed (2025-10-29)

Implemented

- `app/src/hooks/usePanZoom.ts`
- `app/src/hooks/useHover.ts`
- `app/src/routes/visual.tsx` updated to use hooks and remove inline handlers/hover memos

### 5.1 `app/src/hooks/usePanZoom.ts`

- Export `createPanZoomHandlers(canvasStore)` returning handlers: `{ onWheel, onPointerDown, onPointerMove, onPointerUp }`.
- Move existing event logic from the route into these handlers, using `canvasStore` for state updates.
- Keep click detection thresholds and logic; use `canvasStore.setIsPanning`, `canvasStore.setMouseScreen`, etc.

### 5.2 `app/src/hooks/useHover.ts`

- Export `createHoverDerivations({ positionsStore, canvasStore })` returning:
  - `mouseWorld: Accessor<{ x: number; y: number }>`
  - `nearestToMouse: Accessor<{ id?: string; dist2?: number } | undefined>`
  - `hoveredId: Accessor<string | undefined>`
  - `hoveredLabelScreen: Accessor<{ x: number; y: number; title: string } | undefined>`
  - `showHoverLabel: Accessor<boolean>` (screen-distance threshold logic).
- Use `positionsStore.kdTree()`, `positionsStore.positions()`, and `canvasStore.scale()/offset()` to derive these.

### 5.3 Update the route to use hooks

- Instantiate: `const panZoomHandlers = createPanZoomHandlers(canvasStore)`.
- Instantiate: `const hover = createHoverDerivations({ positionsStore, canvasStore })`.
- Wire handlers into the main canvas DOM and use `hover.hoveredId`, `hover.hoveredLabelScreen` in rendering.

### Acceptance criteria (Step 5)

- Route compiles with hooks replacing inline handlers and hover memos.
- Hover labels and opening a doc on click still behave the same.
- Lints clean.

---

## Step 6 — Extract nudge algorithm (pure layout)

Status: Completed (2025-10-29)

Implemented

- `app/src/layout/nudge.ts` (pure, KD-tree based, congestion-scaled repulsion)
- `app/src/stores/positions.store.ts` `runNudge` now calls `nudgePositions` and applies returned adjustments
- `app/src/routes/visual.tsx` Nudge button triggers `positionsStore.runNudge()`

Notes

- Parameters used: `SPREAD=1000`, `MIN_SEP=NODE_RADIUS*2+2` where `NODE_RADIUS=10` (i.e., `MIN_SEP=22`).
- Logs emit every ~50 iterations; function yields every ~10 iterations for UI responsiveness.
- Future tuning: iteration count and force scaling constants may be adjusted based on dataset size.

### 6.1 `app/src/layout/nudge.ts`

- Export `async function nudgePositions(params): Promise<{ adjustments: Map<string, { x: number; y: number }>; stats?: Record<string, number> }>`
  - Inputs:
    - `docs: DocItem[]` (ordered list used to reconstruct positions array)
    - `startPositions: Map<string, { x: number; y: number }>` (current displayed)
    - `minSeparation: number` (e.g., `MIN_SEP`)
    - `spread: number` (e.g., `SPREAD` for central region logic)
    - `iterations?: number` (default 200)
  - Behavior:
    - Move the iterative loop from the route here. Keep the congestion logic and KD-tree usage. No DOM access.
    - Return `adjustments` relative to the store’s `basePositions` (consumer computes relative deltas or provide `basePositions` as an input to compute directly).
- Lightweight `console.log` at coarse intervals (every ~50 iters) is fine.

### 6.2 Integrate in `positions.store.ts`

- Implement `runNudge(iterations?: number)`:
  - Guard on `nudging()`.
  - Build `startPositions` from `positions()`.
  - Call `nudgePositions({ docs: docs() ?? [], startPositions, minSeparation: MIN_SEP, spread: SPREAD, iterations })`.
  - Compute final `adjustments` relative to `basePositions()` and `setAdjustments`.
  - `setLayoutVersion((v) => v + 1)` and log summary.

### Acceptance criteria (Step 6)

- Route’s Nudge button calls `positionsStore.runNudge()`.
- Nudge visibly reduces overlaps (manually verifiable).
- Lints clean.

---

## Remaining work at handoff (next steps)

- Step 7 — Split view into dumb components (component layer)
  - Create `app/src/components/visual/VisualCanvas.tsx` and `app/src/components/visual/ControlPanel.tsx`.
  - Move SVG rendering and left-panel UI into these components; accept props only (no state ownership).
  - Pass `eventHandlers` from `usePanZoom` and use hover values from `useHover`.
- Step 8 — Wire everything in the route (final composition)
  - Compose resources, stores, hooks, and new components in `app/src/routes/visual.tsx`.
  - Ensure `DocumentSidePanel` close handler still refetches docs when needed.

## Step 7 — Split view into dumb components (component layer)

Create a `visual/` subfolder for components:

### 7.1 `app/src/components/visual/VisualCanvas.tsx`

- Props (as a guideline; adjust as needed):
  - `docs: Accessor<DocItem[] | undefined>`
  - `positions: Accessor<Map<string, { x: number; y: number }>>`
  - `hoveredId: Accessor<string | undefined>`
  - `viewTransform: Accessor<string>`
  - `eventHandlers: { onWheel: (e: WheelEvent) => void; onPointerDown: (e: PointerEvent) => void; onPointerMove: (e: PointerEvent) => void; onPointerUp: (e: PointerEvent) => void }`
  - `onSelectDoc: (id: string) => void`
- Render the SVG and nodes. Use `colorFor(title)` for fills.
- Do not own state; derive everything from props.

### 7.2 `app/src/components/visual/ControlPanel.tsx`

- Props (guideline; adjust as needed):
  - `docs: Accessor<DocItem[] | undefined>`
  - `searchQuery: Accessor<string>` and `setSearchQuery: (v: string) => void`
  - `sortMode: Accessor<"proximity" | "title" | "date">` and `setSortMode: (m: "proximity" | "title" | "date") => void`
  - `scale: Accessor<number>`
  - `onNudge: (iterations?: number) => void`
  - Any tiny derived values (counts) needed for display
- Render the existing left panel UI with the search, sort, zoom display, and Nudge button.

### 7.3 Update the route to use components

- Replace inline JSX for the SVG and left panel with `<VisualCanvas />` and `<ControlPanel />`.
- Keep `DocumentSidePanel` as-is (already present at `app/src/components/DocumentSidePanel.tsx`).

### Acceptance criteria (Step 7)

- Route compiles with the new child components.
- No behavior change (rendering, search/sort, hover, click to open, nudge action).
- Lints clean.

---

## Step 8 — Wire everything in the route (final composition)

Perform the final composition in `app/src/routes/visual.tsx` (or optionally move to `app/src/routes/visual/index.tsx` if the router supports directory routes and you prefer to match the plan’s structure).

### 8.1 Data Layer

- Use existing resource hooks:
  - `const [docs, docsCtrl] = useDocsResource()`
  - `const [umapRun] = useUmapRunResource()`
  - `const [umapPoints] = useUmapPointsResource(() => umapRun()?.id)`

### 8.2 State Layer

- `const canvasStore = createCanvasStore()`
- `const positionsStore = createPositionsStore({ docs, umapRun, umapPoints, useUmap: canvasStore.useUmap })`

### 8.3 Interaction Layer

- `const panZoomHandlers = createPanZoomHandlers(canvasStore)`
- `const hover = createHoverDerivations({ positionsStore, canvasStore })`

### 8.4 View Layer

- `<ControlPanel ... onNudge={positionsStore.runNudge} />`
- `<VisualCanvas ... eventHandlers={panZoomHandlers} />`
- `<DocumentSidePanel open={!!canvasStore.selectedId()} docId={canvasStore.selectedId()} onClose={(shouldRefetch) => { if (shouldRefetch) docsCtrl.refetch(); canvasStore.setSelectedId(undefined); }} />`

### Acceptance criteria (Step 8)

- All wiring in place with child components and stores.
- `DocumentSidePanel` refetch causes the docs list to update.
- Lints clean.

---

## Optional — Testing and validation

Although not strictly required to complete the refactor, unit tests will help keep the pure modules stable.

### Targets

- `app/src/spatial/kdtree.ts`
  - Build small point sets and verify `kdNearest` returns the expected id.
- `app/src/layout/umap-normalize.ts`
  - Verify normalization recenters and scales to the expected bounds (within a tolerance).
- `app/src/layout/seeded.ts`
  - Verify deterministic positions for given title+index.
- `app/src/layout/nudge.ts`
  - Construct overlapping points and assert the returned positions or `adjustments` reduce overlaps.

### Notes

- The repo already contains `app/vitest.config.ts`. Place tests under `app/src/**/__tests__/*.(test|spec).ts`.

---

## Definition of Done (overall)

- Steps 4–8 are fully implemented.
- `app/src/routes/visual.tsx` is slim and composes stores, hooks, and dumb components.
- All new modules are pure where intended, and no DOM logic leaks into stores or layout.
- All changed files pass linting and type-checking.
- Manual QA: pan/zoom, hover labels, search/sort, opening a doc, and nudge work as before.
