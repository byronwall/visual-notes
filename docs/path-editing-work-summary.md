# Path Editing Work Summary

## 1. Scope and context

This work fixed three path-editing failures: late saves replacing another note's draft, pointer actions disappearing on blur, and new-note path input losing focus or reparsing its own draft. Source changes are in commits `d4ffdc6`, `b169eb5`, and `3a3cadb`. Local prerequisite `b111071` copies the separately published PR 15 readiness commit `e401804`.

## 2. Major changes delivered

- `d4ffdc6` binds save completions to the active note identity and save version, and preserves a newer draft when an older request completes.
- `b169eb5` keeps path actions within the focus boundary and provides an actions slot for save, bulk apply, and cancel. It also prevents the new-note path draft echo from being parsed as persisted path data.
- `3a3cadb` disables portalling for the path picker in `NewNoteModal` through `DocPropertiesCompactEditors` and `DocumentEditor`, so typing keeps focus in the input inside the dialog.
- The focused Playwright cases cover late saves, path actions, and modal path typing. The final three cases passed on port 3118.

## 3. Design decisions and tradeoffs

- A save result updates state only when its note identity and save version still match. This blocks stale completion without changing normal save behavior.
- Path actions remain inside the editor's focus-out boundary. This keeps suggestions and action targets stable during pointer clicks.
- The new-note path picker stays inline in the modal. Disabling its portal keeps pointer and keyboard focus in the same dialog tree; the tradeoff is modal-specific overlay placement.
- A separate published readiness change, `b111071`, remains a prerequisite and is excluded from these source commits.

## 4. Problems encountered and resolutions

- Source and model checks found that A's completion could overwrite B's draft. Guarded deferred-response tests now preserve B's state.
- Pointer blur collapsed the suggestion panel before Save or bulk apply received the click. Keeping these actions inside the focus boundary fixed the event sequence.
- In the new-note modal, the path input's pointer-down was followed by focus returning to the Unfiled anchor; typing then went to the button. The modal now renders the picker without a portal, and typing remains in the input.
- A later edit to the existing A fixture appended `uditlate.responsecheck` instead of the intended `auditlate.responsecheck`. Its cause remains unproven. This repair makes no claim about that single occurrence.
- The independent modal create check matched request ID and resulting URL, but its selected response showed no ID. The coding test captured response ID `cmvanqicv00gf8cntmm6qg35c` and cross-checked the URL. These are separate provenance results.
- Removing the stale-save guard for a runtime failure proof was rejected by automatic review because it could corrupt data. The guard remained in place; source/model evidence preceded the rejection, and the final runtime checks passed with the guard enabled.

## 5. Verification and validation

- Three focused Playwright cases passed on port 3118. The late-save case held note A's response, switched to B, confirmed B's URL and title, then released A; B's draft stayed intact. It also checked save, bulk apply, persistence, and reopening.
- The modal case initially failed during independent clean-room verification, then passed after the portal change. Before the fix, focus returned to the Unfiled anchor; after it, sequential typing stayed in the input and the path reloaded.
- Full type-check passed. Full lint reported 0 errors and 125 existing warnings. Scoped lint reported 3 existing `DocumentEditor` warnings. Formatting passed for the new test files and `DocPropertiesCompactEditors`; unrelated formatting drift in `DocumentEditor` and `NewNoteModal` remains untouched.
- Independent source review found no further correctness issue in focus or action handling. A same-note failed save can still show its request error beside a newer draft; that message describes the failed request and remains unchanged.
- Independent evidence is in `/Users/byronwall/Projects/visual-notes/tmp/path-cleanroom-evidence.md`. Worktree screenshots include `tmp/path-editor-modal-before-type.png`, `tmp/path-editor-modal-sequential-draft.png`, and `tmp/path-editor-modal-reloaded-path.png`. The browser was closed after verification.
- No merge or deployment occurred.

## 6. Process improvements

- Capture pointer-down, focus, pointer-up, and click targets when a control disappears on blur. This distinguishes a visible control from one that can receive the click.
- Run a clean-room browser pass on the exact modal and route. A passing route test did not cover the nested dialog failure.

## 7. Agent/skill improvements

- Keep evidence provenance explicit when a create response omits an ID. Cross-check the returned ID against the URL. Keep separate observations separate; do not infer an input defect from one uncertain entry. Owner: test author; encode in browser-verification guidance if this pattern recurs.
- Record a safe stale-save proof with deferred responses and state assertions. Do not remove a data-integrity guard to induce a failure. Owner: test author; encode in path-editing test guidance.

## 8. Follow-ups and open risks

- The late-save guard-removal failure was not tested at runtime because automatic review rejected the data-corruption risk. The guarded runtime path passed.
- Preserve the one-character-short fixture as a follow-up context item. Its cause remains unproven.
- Same-note failed-save errors may remain visible beside a newer draft; revisit only if product behavior or user feedback shows confusion.
- Browser checks depend on separately published PR 15 readiness support. Integration can reuse that dependency.
