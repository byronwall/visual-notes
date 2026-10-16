# Inline Title Save Recovery Work Summary

## 1. Scope and Context

The task was to keep a title edit available when its save fails. The affected paths use the shared `InPlaceEditableText` component, including note titles in `DocumentViewer` and `DocumentSidePanel`, and archive titles and notes whose callbacks already return promises.

The source report described an exact full-page note update that returned HTTP 500 while the UI showed “Failed to save note”; the inline editor then closed and discarded the draft. A reload showed the original title. The required boundary was small: shared inline-edit behavior plus the two note-title callers. No cross-document identity, deletion, credential, or result-type work was in scope.

## 2. Major Changes Delivered

- `app/src/components/InPlaceEditableText.tsx` now tracks saving and the Ark preview transition. It retains the attempted draft during submit, displays a saving status, and shows a visible inline error when the commit rejects or throws synchronously. A rejected save reopens the edit with the attempted title.
- Successful synchronous `void` callbacks remain supported because the shared commit handler awaits either a value or a promise.
- `DocumentViewer.handleConfirmEdit` and `DocumentSidePanel.handleTitleCommit` optimistically set the title, restore the previous value on rejection, then rethrow. This lets the shared editor show the failure. Archive title/note callbacks already return their update promises, so their rejections now reach the same shared feedback path.
- The temporary workflow Enter-activation and archive click-propagation hunks were removed from this feature diff after independent verification. The separate workflow change owns them.

## 3. Design Decisions and Tradeoffs

- Keep the existing promise/void callback contract. No result union or new error framework was added.
- Use an inline alert and keep the draft editable after failure. The user can correct or retry without reopening the title control.
- Preserve caller-owned optimistic updates and rollbacks. The shared primitive owns inline feedback; the callers own their title state.
- Follow the installed Ark machine order. On submit, Ark calls `onEditChange(false)` before `onValueCommit`. Treating every `edit=false` as cancellation reset the draft before the save callback began. The component now treats that boundary as a preview transition until the commit outcome is known. Escape still follows `onValueRevert` and restores the original value.
- A prior browser check reported failure after a 13 ms wait. That wait could finish before the promise catch/finally and did not prove settled UI. The corrected trace waited for the actual callback settlement and visible input and alert.

## 4. Problems Encountered and Resolutions

- **Submit callback order differed from the initial assumption.** Instrumentation showed `edit-false` before `value-commit`. The transition state preserves the draft through this order so a rejected save can reopen with the attempted title.
- **An early failure report was invalid.** It used a transient wait that could return before the save settled, and an earlier route attempt used the wrong path. The corrected check used `http://127.0.0.1:3123/docs/cmvalltbt009i8c7pz0otrrow`, waited for the matched request and `onCommit` rejection/finally, then required a visible input and visible alert. The early report is retracted.
- **Escape was not shown to have a general cancellation defect.** The bounded archive trace showed `edit-true → value-change(draft) → edit-false → value-change(original) → value-revert(original) → cancel`; after 56 ms, the original preview was visible, the draft preview was absent, and no mutation request had been sent. Do not generalize beyond this trace.
- **The diagnostic harness needed exact guards.** It now targets one compiled update action and one decoded `{ id, title }` argument matching the owned note and attempted title. It does not intercept unrelated archive POSTs.

## 5. Verification and Validation

- **Failure and retry browser trace:** Passed on `127.0.0.1:3123`. The exact note title request returned synthetic HTTP 500. The decoded payload had one argument with exactly `id` and `title`, matching the note and attempted title; it had no content/body key. After settlement, the attempted title input was visible and enabled, one visible inline alert was present, and the saving status was gone. A same-note retry sent the same exact payload and returned HTTP 200; the editor closed and showed the attempted title.
- **Reload persistence:** A separate clean reload check showed the attempted title persisted and the original body marker remained unchanged as an H1. The combined run's first reload locator timed out; the verifier recorded it as an incomplete attempt and then passed a separate reload-only run.
- **Escape trace:** Passed for one archive title. The original preview returned, the draft preview disappeared, and the server POST count remained zero.
- Evidence: `tmp/title-recovery-complete-trace.json`, `tmp/title-final-report.md`, and `tmp/title-final-report.json`; screenshots: `tmp/title-recovery-save-failure-complete.png`, `tmp/title-recovery-archive-escape-complete.png`, `tmp/title-final-save-failure.png`, `tmp/title-final-retry-success.png`, and `tmp/title-final-reloaded.png`.
- **Static checks:** Pinned pnpm 9.15.9 `type-check` passed. Pinned pnpm 9.15.9 full-app `lint` passed with 0 errors and 128 warnings. Warnings include existing Solid reactivity and style warnings across the app; this pass did not modify lint findings. Earlier full-lint logs remain under `tmp/title-full-lint.txt` and `tmp/note-ack-lint.txt`.
- **Temporary diagnostics:** `[inline-title-trace]` logging was removed from `InPlaceEditableText.tsx` before the causal trace handoff. The current component matches its pre-trace source, including the intended feature and workflow diffs.

## 6. Process Improvements

- **Problem:** A UI wait that checks “not saving OR input exists OR error exists” can report settlement before the save promise resolves. **Change:** Wait for the exact request, observed callback rejection/finally, and visible settled UI together. **Benefit:** Prevents false pass/fail results from transient Ark states. **Suggested owner:** Add this rule to the repo's Playwright audit guidance or the `improve-via-playwright` skill.
- **Problem:** Ark's callback order was assumed rather than measured. **Change:** Record a stable, timestamped component callback trace before changing controlled-state handling. **Benefit:** Fixes the observed lifecycle boundary instead of adding speculative cancellation logic. **Suggested owner:** Add a short callback-order check to shared-component investigation notes.
- **Problem:** Failure injection can affect unrelated mutations if the route handler is too broad. **Change:** Match the compiled action and exact decoded payload. **Benefit:** Keeps the test scoped to the owned note title update. **Suggested owner:** Keep this predicate in the local audit harness patterns, not production code.

## 7. Agent/Skill Improvements

- **Gap:** The default implementation loop did not require evidence that a UI failure wait had observed the actual promise settlement. **Proposal:** Add a verification note to `improve-via-playwright` requiring an awaited terminal callback plus visible target state for async-save failure claims. This should reduce premature conclusions without changing the app's test framework.
- **Gap:** Controlled Ark callback ordering can be a hidden boundary for inline editors. **Proposal:** Add a focused reminder to the Solid UI or props/state skill: inspect the installed Ark machine order before interpreting `onEditChange(false)` as user cancellation. This is a candidate skill update only; no skill file was changed here.

## 8. Follow-ups and Open Risks

- **Workflow integration:** Independent verification is complete. Root removed the temporary workflow-owned source hunks from this feature diff. The separate workflow change owns the Enter-activation and archive click-propagation behavior.
- **Local `d47aa01` support:** This commit is the local PR15 readiness cherry-pick (`e401804`), containing the app hydration marker and browser-check readiness helpers. It is support-only, not title-recovery implementation. Root will remove it from branch history before publishing; no worker action is needed.
- **Local audit artifacts:** `app/scripts/audit-harness.local.ts`, the temporary credential fixture, and `tmp/` evidence are local diagnostic support. The browser verifier is finished. Root owns cleanup: remove the credential fixture and harness, then retain only evidence needed for the handoff. No cleanup was performed by this worker.
- **Scope limit:** Do not infer cross-note authorization, delete behavior, or universal cancellation behavior from these traces. Those probes were outside this work and remain blocked or unverified.
