# Note Mutation Acknowledgments Work Summary

## 1. Scope and Context

This change prevents primary note editors from treating an unconfirmed server action as a successful save. It is in PR [#18](https://github.com/byronwall/visual-notes/pull/18), based on `codex/audit-organization-isolated`, with implementation commit `9dd28e8`.

## 2. Major Changes Delivered

- Added a shared mutation acknowledgment guard in `app/src/hooks/noteMutationAcknowledgements.ts`, used by `app/src/hooks/useNoteMutations.ts`.
- Create requires a nonblank returned ID. Update requires the returned ID to match and `updatedAt` to parse as a date. Delete requires `ok: true` and the matching ID.
- Applied the guard to `DocumentEditor`, `DocumentViewer`, `DocumentSidePanel`, `MetaKeyValueEditor`, and `PathEditor`.
- Create, content, metadata, and path flows retained their drafts and showed an error after an empty HTTP 500 response. Retry then succeeded, and reload showed the saved data. The create retry produced one note and one sidebar link.

## 3. Design Decisions and Tradeoffs

A shared guard keeps acknowledgment rules consistent across mutation callers. It validates the action result at the mutation boundary and leaves each editor responsible for its existing draft and error UI.

The title editor has a separate recovery limitation. Its failed save displayed a browser alert; after dismissal, it reverted and closed, losing the draft. A normal retry and reload confirmed the title persisted. This work does not claim that the title draft survives failure.

## 4. Problems Encountered and Resolutions

The compiled update action returned an empty HTTP 500 without response headers during the failure injection. Before the guard, callers could treat that response as success. The guard now rejects malformed or mismatched acknowledgments, and the tested editors kept local state available for retry.

Delete runtime behavior remains unverified. The browser deletion action was blocked by automatic review because the exact deletion authorization was not trusted. No deletion request or workaround was attempted. Unit coverage verifies the delete acknowledgment guard only.

## 5. Verification and Validation

- All 13 focused mutation tests passed. Independent source review also passed.
- Full TypeScript checks passed.
- Full lint completed with `0` errors and `126` existing warnings.
- Independent browser verification completed for failed saves, retries, reload persistence, and create deduplication. Evidence is in `/Users/byronwall/Projects/visual-notes/tmp/content-ack-before-evidence.md` and screenshots `/Users/byronwall/Projects/visual-notes/tmp/note-ack-after-failed.png`, `/Users/byronwall/Projects/visual-notes/tmp/note-ack-metadata-failed.png`, `/Users/byronwall/Projects/visual-notes/tmp/note-ack-path-failed.png`, `/Users/byronwall/Projects/visual-notes/tmp/note-ack-create-failed.png`, `/Users/byronwall/Projects/visual-notes/tmp/note-ack-create-after-retry.png`, and `/Users/byronwall/Projects/visual-notes/tmp/note-ack-title-failed.png`. Before-failure screenshots are `/Users/byronwall/Projects/visual-notes/tmp/content-ack-before-failure-after-save.png` and `/Users/byronwall/Projects/visual-notes/tmp/content-ack-before-failure-reloaded.png`.
- Browser verification of delete was blocked; only its unit guard was verified.

## 6. Process Improvements

Use failure injection against the compiled server action, then check the visible draft, error, retry, and reload result for each editor. This exposed the title editor's separate draft-loss path while confirming recovery for content, metadata, path, and create. Keep this sequence in the mutation verification checklist.

## 7. Agent/Skill Improvements

For mutation work, record draft retention separately for each caller, including dialogs and inline title edits. A generic statement that “the editor retains the draft” can hide caller-specific recovery behavior. Add this check to the local Playwright or mutation-review guidance.

## 8. Follow-ups and Open Risks

- Fix the title editor's failure path so it preserves the draft after the alert is dismissed, then verify retry and reload behavior.
- Run authorized browser coverage for delete when exact deletion authorization is available. Until then, runtime delete behavior is unknown.
- The browser used separately published harness PR #15 readiness support. The feature change is `9dd28e8`.
- Both test fixtures were retained; no cleanup deletion was performed.
