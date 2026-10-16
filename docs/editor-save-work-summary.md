# Editor Save Work Summary

## 1. Scope and context

Fix note-save acknowledgments, saved-time display, and existing-note settlement behavior. The work changes `DocumentEditor` and `DocumentViewer`. It uses the shared note mutation boundary from `9dd28e8`. Source commits are `ea2b41a` and `c815732`. No backend source changed. Browser verification used the running app with synthetic database `visual_notes_audit_20261016` on port 3120.

## 2. Major changes delivered

- `useNoteMutations` validates note action acknowledgments. Existing-note updates return `{ id, updatedAt }` only when the ID matches and the timestamp parses.
- `DocumentViewer` uses the acknowledged timestamp for both Saved labels. It accepts newer same-note props and ignores older values.
- `DocumentEditor` keeps newer content dirty after an older snapshot saves. It updates cached HTML only when the current editor matches the submitted snapshot. It checks note and editor identity before settlement. It restores selection only when note, editor, content, selection, and focus still match the submission.

## 3. Design decisions and tradeoffs

The settlement check compares current HTML with submitted HTML. This avoids a revision counter and keeps the change local. Equal content is safe to mark clean, even if the user changed and reverted it during the request. The acknowledged timestamp still advances when newer unsaved content remains.

## 4. Problems encountered and resolutions

The BEFORE proof held the normal save response at HTTP 200. Typing during save showed `Saving…`. After release, the editor reverted to the submitted snapshot and showed clean. A second save and reload still showed old content. Holding note A’s save while navigating to B left the URL and header on B, but replaced B’s body with A’s content. BEFORE IDs: A `cmvam9j6n005k8cb33oj3yygq`, B `cmvamgcpy007n8cb3z9qn4d8z`.

The AFTER proof used A `cmvamsmsu00008cy0wx49qv8u` and B `cmvamu5ov000x8cy0li6wt8g8`. With a real HTTP 200 save held open, newer typing stayed visible and showed `Save*`. A second save and reload kept the latest content. While A’s save was held, editing B preserved B’s body, dirty state, route, Saved label, selection, and focus after A settled. Selection stayed collapsed at offset 42 in the same node 99 ms after release.

The Saved label used the route’s old `updatedAt` while activity history refreshed its time anchor. A synchronous DOM read still showed the old label 2 ms after save. After two animation frames, at 22 ms, the label showed `Saved just now`. The response supplied `2026-10-16T07:17:53.529Z`; the tooltip showed the same second in UTC. The activity popover showed the latest Edited event. AFTER evidence in this worktree: `tmp/save-reliability-audit.json`, `tmp/timestamp-caret-followup.json`, and `tmp/timestamp-popover-followup.json`.

## 5. Verification and validation

- `pnpm run lint` — passed with 0 errors and 128 warnings.
- `pnpm run type-check` — passed after Panda code generation.
- `pnpm exec vitest run src/hooks/useNoteMutations.test.ts` — 13 tests passed.
- BEFORE proof on port 3113 reproduced both failures. AFTER proof on port 3120 passed against the synthetic database. The browser is closed. AFTER runs had no console errors or page errors; Vite and Canvas warnings remained.
- `git diff --check` — passed.

## 6. Process improvements

Keep a held-response browser check for typing during save, note navigation during save, and Saved timestamp updates. It exposed failures that a successful-save-only check missed. Suggested home: the editor verification checklist in `AGENTS.md`.

## 7. Agent/skill improvements

When reviewing async editor saves, check submitted note identity, editor identity, and content ownership before clearing dirty state or restoring selection. This makes late responses visible during source review. Suggested home: `solid-props-state-patterns`.

## 8. Follow-ups and open risks

- First-note creation, save errors, title edits, and deletion remain unproved source candidates. No defect claim is made for these flows.
- The existing-note guard uses HTML equality. It does not add revision tracking or change the create path.
