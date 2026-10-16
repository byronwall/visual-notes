# Late Note Callback Identity Work Summary

## 1. Scope and context

This work addresses late note callbacks in the canvas detail panel and `/docs/[id]`. The initial fix handled A→B changes. Later offline proof showed that ID checks alone still fail after A→B→A and that old failures can alert over B.

The implementation is based on exact commit `125c8c16e3fbf70dc1a770e0ad35b8b3e316c834`. It changes only `DocumentSidePanel.tsx` and `DocumentViewer.tsx`. It does not change `DocumentEditor.tsx`, the mutation helper, route callbacks, or database code.

## 2. Major changes delivered

- `app/src/components/DocumentSidePanel.tsx` tracks a local generation. It increments only when `docId` changes. Title rollback now requires both the same ID and the same generation.
- `app/src/components/DocumentViewer.tsx` tracks the generation when `props.doc.id` changes. Title rollback and H1 success writes require the same note visit. H1 and delete failure alerts also require that viewer to remain active.
- The existing `onCleanup` now marks the viewer inactive while preserving editor API cleanup.
- Delete success remains independent of generation. It always calls `onDeleted(deletedDocId)` so the caller can refresh the list.

The caller contract is: ordinary close uses `onClose()`, and delete uses `onDeleted(docId)`. The parent should refresh after every successful delete. It should clear selection and pending/discard state only when the selected ID matches the deleted ID. The full-page route should navigate home when its current ID matches the deleted ID. These caller effects were represented by test shells; this work did not change the production `CanvasRoute` or route module.

## 3. Design decisions and tradeoffs

ID checks do not distinguish two visits to the same note. A local generation does. Each owner increments its generation only when the displayed note ID changes, so title updates and resource refreshes do not invalidate a valid same-note response.

The keyed panel viewer needs an owner-lifetime check. After cleanup, its captured `props.doc.id` can still be A. The `ownerActive` check prevents that disposed viewer from showing A's late H1 or delete failure over B.

Delete success must not use the generation guard. A successful background delete must reach the parent for list refresh. If selection returns to A before the acknowledgment, A has still been deleted; closing that selection is correct.

## 4. Problems encountered and resolutions

The clean worktree had no generated `styled-system` files, so its first type check failed across the app. Running the repository's `pnpm panda codegen` restored those generated files. The next type check passed.

The initial generation snapshot read produced two new Solid reactivity warnings. Both snapshots now use `untrack`. Full lint returned to 128 warnings, with zero errors and no new snapshot warnings.

## 5. Verification and validation

Independent offline verification passed all 19 prepared cases against the current source. The first nine cover the original A→B and same-note cases. Five lifetime cases reproduce the additional A→B→A and stale-alert failures from the original source; all five invariants now pass:

| Lifetime case | Original behavior | Verified behavior |
| --- | --- | --- |
| Panel A1 title rejection after A→B→A and a successful A2 title save | A1 rejection rolled the current A title back from `A2 newer title` to `Alpha title`. | Panel generation blocks the old A1 rollback. |
| Route A1 H1 success after A→B→A and a successful A2 title save | A1 success replaced the current A title `A2 newer title` with `Alpha heading`. | Viewer generation blocks the old A1 title write. |
| Route A H1 failure while B is visible | A's late failure alert appeared over B. | The stale alert is suppressed. |
| Route A delete failure while B is visible | A's late failure alert appeared over B. | The stale alert is suppressed. |
| Keyed panel A delete failure after B is visible | The disposed A viewer's alert appeared over B. | The disposed viewer's alert is suppressed. |

Five same-visit and delete-success controls also passed: current route H1 failure still alerts; current route and panel delete failures still alert; A deletion after panel A→B→A refreshes and closes current A while clearing pending/discard shell state; and A deletion after route A→B→A navigates home. The original nine cases passed too: panel late title failure; same-note title failure and retry; panel late delete acknowledgment; same-note panel delete; route late title failure; route late H1 success; same-note H1 success; route late delete acknowledgment; and same-note route delete. Together these are 19 of 19 passed. Panel mode has no H1 sync control, so no panel H1 failure handler was tested.

The verifier used observed request IDs and titles, plus valid acknowledgments for successful callbacks. Component hashes matched the worktree: `DocumentSidePanel.tsx` `8596c2347a8d7f27bdffb4dfe6c831a018dea097454323c466a579517f0b0de3`; `DocumentViewer.tsx` `4d63b24a13ae289cebf2c0d2178264f8e00d01da373eefcbf44bcca9fb760de3`; and the unchanged acknowledgment helper `noteMutationAcknowledgements.ts` `3f4d43c8f286e837c9cc7bc487e2d89aaf81dc6066ac66e95dfb11107fe9d148`. Full source fidelity details are in `/private/tmp/late-note-callback-lifetime-independent/SOURCE_FIDELITY.md`.

Checks in the current worktree:

- `pnpm panda codegen`: passed.
- `pnpm type-check`: passed.
- `pnpm lint`: passed with zero errors and 128 warnings.
- `git diff --check`: passed.
- Independent offline browser verification: 19/19 passed with zero browser or page errors. The fixture server on port `43935` and browser process were closed after the run. Screenshot: `tmp/late-lifetime-final-panel.png` (SHA-256 `261875b80e9e9ea595078547ec0e9ee9831f2aa67c2109b780e6c70b81560300`).

The independent results are in `/private/tmp/late-note-callback-lifetime-independent/RESULTS.md` and `RESULTS.json`; original-source reproductions are in `/private/tmp/late-note-callback-scopes/`. The fixture mounted actual copied Panel, Viewer, inline title editor, editable wrapper, heading utility, and mutation acknowledgment helper sources. It used real Solid `createResource` and unkeyed `Switch`/`Match` in its route shell, with local A/B data, router controls, confirmation dialog, editor, alert recorder, and callback/refetch counters. It did not mount production `CanvasRoute`, a database-backed note list, authentication, or real deletion. Refetch and pending/discard results verify the represented parent callback contract only; they do not verify production list or database behavior.

## 6. Process improvements

The callback test matrix should include A→B→A and late failure cases, not only A→B. Keep same-visit retry cases in that matrix to catch guards that suppress valid current errors. These checks belong in the offline callback fixture used for note mutation work.

## 7. Agent and skill improvements

None. Existing Solid guidance was sufficient. `pnpm type-check` caught the missing generated style system, and lint caught the untracked initial prop reads.

## 8. Follow-ups and open risks

No verification follow-up remains for this patch. The independent fixture passed all 19 cases. Production route and list integration were outside the fixture and remain unverified here.

When composing this patch with root's `707ef9e` pending-save and API saving-state work, keep the separate `onClose()` and `onDeleted(docId)` callbacks and preserve editor API forwarding. On delete success, always refetch. Clear selection, pending selection, discard state, and save-dialog state only when the current selected ID matches the deleted ID. Do not generation-gate delete success: deleting A during A→B→A means the current A must close even though it is a later visit.

No production route, app server, authentication, database, or real deletion was tested. The fixture did not test panel H1 failure because no panel H1 control exists. Test-shell parent callback effects are observations of the supplied contract, not proof of production `CanvasRoute` behavior. No PR was created by this task.
