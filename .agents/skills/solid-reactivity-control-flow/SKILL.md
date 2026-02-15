---
name: solid-reactivity-control-flow
description: Apply SolidJS reactivity and render control-flow patterns that avoid stale UI and type-unsound branching. Use when editing conditional rendering, derived state, effects, list rendering, or resource loading boundaries.
---

# Solid Reactivity + Control Flow

Use this skill for Solid rendering logic and reactive correctness.

## Goals

- Keep render branches reactive and type-safe.
- Avoid accidental stale branches and unnecessary recomputation.
- Use Solid control-flow primitives consistently.

## Rules

1. Use Solid control-flow components for branching.
   - Prefer `Show` over `&&` for conditional JSX.
   - Prefer `Switch`/`Match` for multi-branch top-level forks.
2. Do not use top-level signal-gated early returns for branches that must update later.
   - Avoid: `if (!mounted()) return <Fallback />`.
   - Prefer: `<Show when={mounted()} fallback={<Fallback />}>...</Show>`.
3. Use `Show` function children when type narrowing matters.
4. Use `createEffect` for side effects; do not use effects for pure derivation.
5. Prefer inline derived thunks for cheap derivations.
   - Use `createMemo` only for expensive derivations (sorting/filtering/heavy mapping).
6. Prefer `<For>` over `.map()` in JSX.
   - Treat render locals as reactive functions when wiring downstream behavior.
7. If `createResource` is involved, always gate the resolved UI with `Suspense` and a fallback.
   - Avoid using `Show` as the primary loading gate for resources.

## Common Pitfalls

- Non-reactive top-level branch locks a component into fallback.
- Mixed `&&` rendering and non-null assertions (`!`) bypasses safe narrowing.
- Overusing `createMemo` for trivial string/prop composition.
- Resource loading branches outside `Suspense` causing inconsistent loading UX.

## Verification Checklist

- Render branches use `Show` or `Switch/Match`.
- No top-level signal-gated early return that should re-render later.
- Expensive derivations are memoized; simple ones use thunks.
- Lists render with `<For>`.
- Resource-backed UI is wrapped in `Suspense` fallback.
