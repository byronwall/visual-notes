# Note Create Callback Lifetime Work Summary

## 1. Scope and context

A pending create from canceled draft A could call `NewNoteModal` after draft B opened. That callback closed B and navigated to A. Production code changed only `app/src/components/DocumentEditor.tsx`; no authenticated session, live database, or server action was used.

## 2. Major changes delivered

`DocumentEditor` records disposal with a local flag and `onCleanup`. After create resolves, a disposed editor returns before clearing dirty state or calling `onCreated`. The change adds five lines. Existing-note acknowledgement and newer-draft behavior stay unchanged. The create action is not canceled, so late A may still persist.

## 3. Design decisions and tradeoffs

The guard sits after the shared create response. It preserves mounted creates and leaves modal ownership, action transport, and server behavior unchanged. It protects UI state but does not roll back persistence. Route leave was outside scope and its guard was mocked, so no route-leave behavior is claimed.

## 4. Problems encountered and resolutions

The baseline test bypassed its alias through a direct import; it now uses the configured path. The A-to-B proof also selected disposed A as B; it now checks distinct identity and liveness.

The fixture first lacked a relative alias for `./DocPropertiesCompactEditors`; it was added. A later attempt found pending-action buttons behind the modal overlay. They now sit in a fixed panel above it.

## 5. Verification and validation

The offline harness runs compiled `DocumentEditor` and `NewNoteModal` with mocked Tiptap, UI wrappers, router, and action transport. Deferred promises drive responses. Proof logs are in `tmp/create-lifetime-proof/`.

Offline proof passed 4/4; baseline had two expected failures and two passing controls. Full app tests passed 57 tests across 11 files; type-check passed; lint had zero errors and 128 existing warnings. `git diff --check` passed.

Independent desktop attempt 3 passed both modes. Baseline closed B and showed `/docs/synthetic-note-1`; patched kept B's exact text, with no navigation, zero pending creates, and only A in the payload. B then saved to `/docs/synthetic-note-3`. A fresh create passed; rejecting disposed A preserved B and showed no navigation. The run had no console errors, warnings, or non-static requests. Screenshots and verifier output are in `tmp/create-lifetime-proof/render-attempt3/`. The verifier read or edited no source.

## 6. Process improvements

Use the configured alias for every component import in baseline and patched proofs. Assert distinct editor identity and liveness when an old instance is disposed and a new one mounts. These checks prevent mixed implementations and false-positive survival assertions.

## 7. Agent and skill improvements

When proof modes compile alternate components, inspect all imports after aliasing and choose instances by live state rather than array position. Add this rule to test-harness guidance if these comparisons recur.

## 8. Follow-ups and open risks

The check used a desktop viewport. It did not test narrow layouts, full routes, real Tiptap, or database persistence. Existing-note acknowledgement and newer-draft behavior have offline proof only. The route-leave guard was mocked, and the fixture shows only the latest synthetic path.
