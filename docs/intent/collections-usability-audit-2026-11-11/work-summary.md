# Collections audit work summary

## Scope and context

The request was a deep usability/UI audit, a likely ideal design, a gap analysis, detailed Product Grid nodes in the repository, images where possible, and a draft PR. Laptop viewports are included alongside phones. This change implements no product fixes and does not merge or deploy anything.

## Major changes delivered

- A new `collections-usability` Product Grid project, with an audit root, five areas and 19 actionable problem nodes.
- A likely ideal design, prioritized gap matrix, standards/reference register and stable issue index.
- Synthetic real-component browser evidence, explicit coverage limits and a repeatable reassessment protocol.
- Existing Collections intent and Pathways PGM records are preserved unchanged.

## Design decisions and tradeoffs

Keep the laptop table and notes-native identity. Offer a compact narrow record-list presentation and readable full-detail surface, with Table still available for comparison. Do not mistake existing sticky headers, resizing, bulk edit, windowing or body-save protection for missing features. Label source risks separately from observed browser behavior. A 44px phone comfort goal is not the WCAG AA threshold; horizontal scrolling is not itself proof of a reflow failure.

## Problems encountered and resolutions

The deployed app required sign-in, and this environment had no configured isolated Postgres database. Instead of using private production data, the audit rendered actual components against synthetic fixtures and stubbed actions. This yielded legitimate layout and keyboard evidence without claiming full application or persistence coverage. Long-text property detail uses the real PropertyList but intentionally omits the full note editor. Full route, backend failure, device keyboard and screen-reader validation remain explicit follow-ups.

The default Corepack cache was unwritable. Setting `COREPACK_HOME` to a writable temporary/workspace cache allowed the repository-pinned pnpm 9.15.9 to run. No dependency manifest or lockfile change was needed.

## Verification and validation

Local checks on the unchanged application source baseline:

- `pnpm lint`: passed, with 157 pre-existing warnings and no errors.
- `pnpm type-check`: passed.
- `pnpm test`: 145 files passed, 15 skipped; 888 tests passed, 51 skipped. Skipped/database-dependent cases are not a full integration pass.
- PGM consistency report and local-link/image-manifest validation: recorded in [evidence.md](evidence.md).
- Browser evidence: actual-component fixture, not deployed end-to-end. Coverage, measured values and screenshots are in [evidence.md](evidence.md).
- Production build, authenticated application E2E, database failure cases, real mobile hardware and assistive-technology checks: not run in this audit.

A draft PR's CI state must be checked for its exact head SHA separately from these local results. The repository's CI also runs build/browser checks; a pending or failed check is not reported as a pass.

## Process improvements

Use stable CU IDs and retest IDs so fixes can attach evidence without rewriting original observations. Keep test data shape realistic, but synthetic and safe for a public repository. Record actual content width and scrollbar behavior rather than relying only on device labels. Use at least 300 rows when testing virtualization; 110 does not activate it.

## Repository guidance improvements

No instruction or skill files changed. A future repository checklist could require Collections fixes to test visible Open/selection, Tab boundary escape, long-text fields and 15-view navigation on both a phone and a laptop. The [reassessment protocol](reassessment.md) is the proposed home for this requirement until the team chooses to incorporate it in normal review.

## Follow-ups and open risks

Validate the proposed narrow list/detail design with representative review and comparison tasks. Reproduce overlapping property failures, failed view saves, keyboard windowing, pointer cancellation and real-device interactions against the isolated full app. Do not mark these risks fixed solely from screenshots or source changes. Preserve the existing note-body close guard and membership/deletion semantics.
