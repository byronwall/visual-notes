# Preview Batches Work Summary

## 1. Scope and context

Fix missing hover previews beyond the 120-ID service cap and verify freshness after note creation and edits. Keep the cap. No schema, writer, or provider changes were in scope.

## 2. Major changes delivered

- `app/src/services/docs.queries.ts` adds a shared 120-ID batching helper. An outer query serializes the combined result for hydration; inner preview queries retain per-chunk keys.
- `app/src/features/docs-index/hooks/useDocPreviewMap.ts` and `app/src/routes/path/[...segments].tsx` use the shared helper. `PathNoteGroups` mounts after path data resolves.
- `app/src/features/docs-index/components/DocsIndexPage.tsx` gates `ResultsSection` on unkeyed `docs.latest`. The list stays mounted during revalidation and starts preview queries with resolved rows.
- Tests cover normalized, ordered results at 120, 121, and 200 IDs, plus append, edit, and shrink behavior.

## 3. Design decisions and tradeoffs

Bounded chunks preserve the service limit and stable chunk keys. Removing the cap creates an unbounded request. A permanent incremental map risks stale or retained entries. Both alternatives were rejected.

An outer query serializes for hydration while inner queries keep chunk keys. We rejected a captured global `Promise` workaround because it bypasses Router hydration. We removed a mock hydration-cache test because it repeated implementation logic.

## 4. Problems encountered and resolutions

Browser passes 1–3 found missing path previews and empty previews after writes. Earlier fixes passed unit checks but failed browser checks. Resolved-data boundaries fixed pass 4. The exact Router trigger remains unproven; the verified mechanism starts preview resources with resolved rows.

Failed evidence remains in `tmp/preview-batches-failed-pass/`, `tmp/preview-batches-second-failed-pass/`, and `tmp/preview-batches-pass3/`.

## 5. Verification and validation

All commands used cached pnpm 9.15.9.

- `pnpm test`: 40 tests passed.
- `pnpm type-check`: passed.
- `pnpm lint`: 0 errors and 130 warnings.
- `git diff --check`: passed.
- Browser pass 4 verified created note `cmvao3e6d00028c3d7ky0hit9` and edited fixture 001 before and after visiting Paths. Path rows 002, 121, and 200 showed previews. Notes expanded 100 → 200 → 204; rows 121 and 200 showed previews. Search, clear, two-row selection, and selection through Show more worked. Browser snapshots had 0 errors and 19 warnings.
- Proof: `tmp/preview-batches-pass4-proof.json`; screenshots: `tmp/preview-batches-pass4-main.png` and `tmp/preview-batches-pass4-path.png`. Source hashes and diff matched the frozen source.
- Request counts, cache-hit rates, database cost, and full-library latency were not measured.

## 6. Process improvements

Freeze and hash source before independent browser passes; isolate fixtures. Wait for the visible hover card, not hidden duplicate text. Compare server request logs with UI results. Review Router action invalidation before blaming query caching. Record these checks in the browser playbook to prevent false confidence from unit tests.

## 7. Agent/skill improvements

No skill files changed. Consider adding a SolidStart skill note: mount dependent preview queries after parent data resolves, and verify hydration in a browser. This reduces reliance on Router mocks.

## 8. Follow-ups and open risks

The 120-ID limit remains. Preview cost, chunk reuse after edits, and full-library latency are unmeasured. Pass 4 found no remaining user-visible failure.
