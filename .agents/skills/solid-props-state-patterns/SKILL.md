---
name: solid-props-state-patterns
description: Enforce SolidJS prop and state patterns that preserve reactivity and prevent feedback loops. Use when editing props, local draft state, batching updates, context providers, refs, and lifecycle cleanup.
---

# Solid Props + State Patterns

Use this skill when state ownership and update mechanics are the main risk.

## Rules

1. Do not destructure props in params or function body.
   - Use `splitProps` for local naming.
   - `mergeProps` is allowed.
2. Choose state primitive by cohesion.
   - `createSignal` for isolated values.
   - `createStore` for related state that should update cohesively.
3. Batch multi-field updates that represent one user-visible change.
   - Use `batch(() => { ... })` to avoid transient invalid states.
4. Guard parent/child feedback loops (`value` + `onChange`).
   - Skip no-op emits.
   - Sync prop-initialized draft state only when the incoming prop actually changed.
5. Context conventions.
   - Avoid prop drilling beyond three levels.
   - Expose provider + `useX()` helper that throws outside provider.
   - Keep provider logic small; move non-UI logic into shared modules.
6. DOM refs and lifecycle.
   - Use `let ref` + `ref={ref}`.
   - Do not use `document.getElementById`.
   - When pairing `onMount` and `onCleanup`, put `onCleanup` inside the `onMount` callback.

## Anti-Patterns

- Draft state constantly reset from mutable local state comparisons.
- Unbatched multi-field writes causing flicker or invalid callbacks.
- Context usage without safety helper.
- Global DOM lookups for nodes already owned by components.

## Verification Checklist

- No prop destructuring.
- Correct signal/store choice for the edited state.
- Batched related updates.
- Prop sync guarded by previous incoming value snapshot.
- Context includes a safe consumer hook.
- Ref and cleanup patterns follow Solid conventions.
