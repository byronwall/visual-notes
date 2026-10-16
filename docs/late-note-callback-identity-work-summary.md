# Late Note Callback Identity Work Summary

## 1. Scope and context

This change fixes five proven cases where an asynchronous note callback for A affected the newly selected note B. The affected surfaces are the canvas detail panel and `/docs/[id]`.

The task was limited to identity checks and caller contracts. `DocumentEditor.tsx`, the note mutation helper, and the inline editor implementation were left unchanged. No app database, authentication flow, or real delete action was used during verification.

## 2. Major changes delivered

- `app/src/components/DocumentViewer.tsx` captures the note ID before title, H1, and delete actions. After awaits, local title writes and fallback navigation apply only while that note remains current. `onDeleted` now receives the deleted ID.
- `app/src/components/DocumentSidePanel.tsx` keys its title editor by `docId`, guards title rollback by the captured ID, and separates ordinary `onClose()` from `onDeleted(docId)`.
- `app/src/routes/canvas.tsx` refreshes the note list after every successful delete. It clears pending selection, discard state, and selection only when the deleted ID is still selected.
- `app/src/routes/docs/[id].tsx` navigates home after delete only when the route ID matches the deleted ID.

The side panel continues to forward the editor API callback. The API and mutation validation remain unchanged.

## 3. Design decisions and tradeoffs

Each asynchronous callback captures the ID at the start of the action. A direct equality check then protects local state after the await. This keeps identity logic at the affected callback sites.

Delete handling has its own callback because list refresh and selection close have different conditions. A successful delete always refreshes the canvas list. Closing B after deleting A would lose current user context, so selection clears only for a matching ID.

The panel title editor remounts when `docId` changes. This resets A's draft and error state when B becomes selected. Same-note failures still retain their draft and error.

## 4. Problems encountered and resolutions

TypeScript rejected a render-function child inside `<Show keyed>` for the string `docId` condition. The editor is now passed as a direct child, which matches the keyed string overload. Type checking then passed.

The original baseline proof files were preserved. Verification used a separate copy at `/private/tmp/late-note-callback-patched`; its component copies match the changed worktree files by SHA-256.

## 5. Verification and validation

Independent Chromium verification passed all nine cases in `/private/tmp/late-note-callback-independent/REPORT.md` and `report.json`. The five cross-note cases were:

| Case | Before | After |
| --- | --- | --- |
| Panel title rejection | A's draft/error could appear on B; Escape could restore A's title while B stayed selected. | B keeps its title; A's keyed editor and error do not remain visible. |
| Panel delete success | A's late success could close selected B. | The list refreshes; B stays selected. |
| Route title rejection | A's rollback could replace B's title. | B's title stays visible. |
| Route H1 sync success | A's success could replace B's title. | B's title stays visible. |
| Route delete success | Deleting A could navigate away from B. | B remains on the route. |

The four same-note controls also passed. Panel title failure retained A's draft and error. A retry with a valid acknowledgment updated A and cleared the error. Panel deletion of A closed its selection and incremented the fixture's refetch count. Route H1 sync updated A, and route deletion of A navigated home.

The independent fixture copied the worktree's actual `DocumentViewer.tsx`, `DocumentSidePanel.tsx`, `InPlaceEditableText.tsx`, `extractHeading.ts`, and `createNoteMutations` helper. Their hashes matched the worktree files. Deferred local promises went through the actual mutation helper, which validated success acknowledgments. Requests remained addressed to A after B appeared. The run used Chromium and temporary Vite at `127.0.0.1:43931`. It had zero browser and console errors. The browser and server are closed.

The panel fixture used the actual persistent `DocumentSidePanel` and keyed `DocumentViewer`. Its side panel, dialog, editor, and other non-target children were shells. The route fixture used the actual unkeyed viewer beneath Solid `createResource` and `Switch`/`Match`, with fake A/B reads and router controls. It did not mount the actual `CanvasRoute` or its database-backed note list. Refetch, selection, and pending/discard results are shell observations of the actual callback contract. The fixture did not use the app server, authentication, database, or real deletion.

Commands and outcomes:

- `pnpm type-check` in `app/`: passed.
- `pnpm lint` in `app/`: passed with zero errors and 128 warnings.
- `git diff --check`: passed.
- Independent nine-case offline Chromium fixture: passed, with zero browser or console errors.

The original baseline source hashes remain unchanged: `DocumentViewer.tsx` `4d95da525f2ea0de255c61c6f32840836dc54a8cbfc2ba3ccf3bdf89c94be386`, `DocumentSidePanel.tsx` `65a5284375ebc69e83c14f1b8af22682a89e86fecb026ee4cc99acdd20abcb1c`, and `InPlaceEditableText.tsx` `feb880afbd228a1a93ffbfa8789a8bfb7f4cf3dbfb585b79249513b05d85d53a`.

Independent fixture source hashes:

- Worktree `DocumentViewer.tsx`: `916d6edf43e60cb051c9f8ae6b8fce8a44cc5fa4f6294ffc9805976998c74e30`.
- Worktree `DocumentSidePanel.tsx`: `2e896e0f2e932f3680de8e601c90e15c7c921e6efeb9eb0bcdb5bdabbc671466`.
- Worktree `InPlaceEditableText.tsx`: `feb880afbd228a1a93ffbfa8789a8bfb7f4cf3dbfb585b79249513b05d85d53a`.
- Worktree `extractHeading.ts`: `9861e5cd3379afa9c1d5c6a6502a8084edbff5768d20b09d13130bea0904e069`.
- Worktree `noteMutationAcknowledgements.ts`: `3f4d43c8f286e837c9cc7bc487e2d89aaf81dc6066ac66e95dfb11107fe9d148`.
- `/private/tmp/late-note-callback-independent/REPORT.md`: `6fb7448417708eccb15bb01dc7dcfd8819f0b74c8ad783f8c013dd693b41a847`.
- `/private/tmp/late-note-callback-independent/report.json`: `78d2ac2605904fb36d1cd129afcd977ff0a1549d200de8fb24fd94e6797f0299`.
- Offline panel screenshot `tmp/late-identity-final-panel.png`: `a269a021b7c2c29da8fc981441c2dfb4dce146ba550c85aa7c1a80528cc45133`.

## 6. Process improvements

The caller audit found that one boolean close callback represented both ordinary close and delete success. Separate callbacks make the deleted identity and refresh behavior explicit. Keep this caller audit when porting the change into the pending-save integration branch.

## 7. Agent and skill improvements

None. Existing Ponytail guidance already requires checking all callers. The type check caught the keyed-child mismatch during implementation.

## 8. Follow-ups and open risks

Root owns the combined integration based on `707ef9e`, including the pending-save guard and API saving-state forwarding. Port the separate callback contract into that branch: ordinary `onClose()` and `onDeleted(docId)`. Keep the pending-save guard around the matching-ID selection clear. Preserve unconditional list refresh after successful deletion and editor API forwarding.

The source still uses global alerts for an A H1-sync or delete failure. Such an alert may appear after B becomes active. The nine cases did not test those failures. This remains an unverified source candidate with different product meaning; no speculative guard was added.

The fixture validates mocked callback behavior. It does not prove production server or database behavior. No PR was created in this worker task.
