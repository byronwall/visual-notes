---
name: solid-structure-types-quality
description: Enforce SolidJS file organization, TypeScript hygiene, error boundaries, and verification gates. Use when reviewing or refactoring code quality and before finalizing frontend changes.
---

# Solid Structure, Types, and Quality Gates

Use this skill as a quality pass for Solid code changes.

## Structure and Module Rules

1. One component per file by default.
   - Small private helper components are acceptable when tightly related.
2. Keep prop types in the same file as their component.
   - Promote reusable shared types to common type modules.
3. Move reusable helpers to shared utility locations.
4. Imports at top of file only.
   - No inline/lazy imports.
5. Prefer named exports over default exports.
6. Prefer `import { type Foo } from "./foo"` over `typeof import("./foo").Foo`.

## TypeScript Hygiene

- Avoid `any`; if unavoidable, explain with a comment.
- Avoid `as any`; if unavoidable, annotate `TODO:AS_ANY, <reason>`.
- Avoid mirror types; derive from existing values/returns.
  - If blocked, annotate `TODO:TYPE_MIRROR, <reason>`.
- Prefer `type` over `interface`.

## Reliability and Safety

1. Wrap each major feature island in `ErrorBoundary` with user-friendly fallback.
2. Avoid noisy `console.log` in shipped UI; keep only durable signal logs.
3. Avoid `try/catch` unless clearly justified.
4. For responsive shells, mount route/page children exactly once (no hidden duplicate branches).
5. Consider edge cases; if non-trivial, annotate `TODO:EDGE_CASE, <reason>`.

## Verification

1. Run `pnpm type-check` in `app/`.
2. Do not use `pnpm build` for routine verification.
3. Run manual checks for edited flows.
4. Optional cleanup before commit: `cd app && pnpm run fix:unstaged`.

## Quick Review Checklist

- Component/file boundaries are clean.
- Imports/exports and type imports follow conventions.
- No uncontrolled `any` or `as any`.
- Error boundaries and logging discipline are intact.
- `pnpm type-check` passes.
