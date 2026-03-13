---
name: improve-via-playwright
description: Use Playwright to diagnose and improve a running UI through real browser interaction, screenshots, DOM inspection, and iterative verification. Best for finding and fixing UX friction in live flows such as forms, dialogs, inline editing, focus, hover affordances, responsive overflow, scrolling, and interaction polish.
---

# Improve Via Playwright

Use this skill when the user wants a real browser-driven UX pass on an existing app, not just a source review.

This skill is for reproducing friction in a running interface, identifying the highest-value UX issues, applying focused fixes, and proving the result in the browser.

## Use This Skill When

Use this skill when the request is primarily about improving an existing UI through live interaction, such as:

- finding what feels confusing, slow, fragile, or annoying in a real flow
- auditing a page, form, dialog, or editor in the browser
- fixing focus, hover, disclosure, overflow, scrolling, or responsive behavior
- improving inline editing, selection/edit affordances, or optimistic interactions
- validating that a UX fix actually works after code changes
- taking screenshots to document before/after behavior

## Do Not Use This Skill When

Do not use this skill when the request is better handled by a different workflow, such as:

- writing Playwright test coverage without a UX diagnosis goal
- reviewing code without access to a running UI
- making broad design-system or visual rebranding changes
- debugging backend correctness with little or no visible UX impact
- implementing a brand-new feature from scratch before a usable UI exists

If the app cannot be run or accessed, fall back to code review and be explicit that browser verification was not possible.

## Core Principles

- Reproduce the user’s actual friction in the browser before changing code.
- Prioritize issues by user impact, not by implementation convenience.
- Make focused, minimal-risk changes.
- Re-test the exact interaction after each meaningful fix.
- Use evidence: screenshots, DOM inspection, focus checks, console state, and measured layout where useful.
- Treat unstable interaction state as a UX problem, not just a logic bug.
- Do not claim something is fixed until it is verified in the browser.

## Inputs To Gather

Before changing code, gather as much of the following as is available:

- route or flow to test
- expected user outcome
- viewport assumptions
- authentication or setup requirements
- relevant seed data or entity state
- any specific complaint from the user
- whether the issue is desktop-only, mobile-only, or unknown

If details are missing, start from the most likely real user flow and document assumptions.

## Repo-Specific Setup

In this repo, use these local Playwright/MCP assumptions unless the user says otherwise:

- The app server is usually already running on port `3000`.
- Use the IPv6 loopback URL `http://[::1]:3000` for local browser access.
- The Playwright MCP server is configured to run with `--isolated`, so separate
  Codex threads get independent browser instances and do not fight over shared
  profile state.
- If an explicit base URL is needed for Playwright test runs, use
  `PLAYWRIGHT_BASE_URL=http://[::1]:3000`.

## Priority Rubric

Fix issues in this order:

### 1) Task-blocking issues

Problems that stop the user from completing the flow.

Examples:

- primary action is hidden, clipped, disabled incorrectly, or unreachable
- dialog traps the user
- editing cannot be committed or canceled reliably
- content becomes inaccessible because of overflow or layering

### 2) Task-slowing issues

Problems that make completion confusing, error-prone, or inefficient.

Examples:

- unclear click targets
- overloaded interactions
- poor field order
- missing autofocus
- fragile hover-dependent controls
- jarring layout changes while editing

### 3) Trust-reducing issues

Problems that make the UI feel unreliable even if it technically works.

Examples:

- server flashbacks after commit
- focus jumps with no clear destination
- flicker during save
- transient stale values
- inconsistent affordances
- console errors tied to the interaction

### 4) Pure polish issues

Visual or motion improvements that do not materially affect task success.

Only work on these after higher-priority issues are handled.

## Browser Investigation Workflow

### 1) Start in the running app

- Navigate to the target route or flow first.
- Complete any required setup or authentication.
- Reproduce the issue in the browser before reading code deeply.
- Use accessibility snapshots and locator inspection to understand structure and interactive targets.

### 2) Build a structured findings list

For each issue, capture:

- title
- repro steps
- observed behavior
- expected behavior
- user impact
- severity: blocking / slowing / trust / polish
- suspected cause
- evidence collected

Do not fix random issues opportunistically. Focus on the highest-value findings first.

### 3) Capture evidence before changes

Take at least one screenshot for the problematic state.

When useful, also inspect:

- element bounding boxes
- scroll containers
- focus target
- computed visibility or clipping
- console errors triggered by the interaction

Prefer direct measurement when visual judgment is ambiguous.

### 4) Patch one coherent issue at a time

- Keep the change small and targeted.
- Avoid broad refactors unless necessary to stabilize the UX path.
- Preserve existing behavior outside the problem area.
- If a deeper architectural change is required, document why.

### 5) Reload and re-run the exact flow

After each meaningful patch:

- reload the relevant route
- repeat the same interaction
- verify behavior
- verify visual result
- check console output again

Do not stop at “the code looks right.”

## What To Look For

Inspect for issues in these categories:

### Information architecture and disclosure

- primary fields buried under secondary metadata
- advanced settings shown too early
- poor field grouping or ordering
- missing labels or instructions at decision points

### Click targets and affordances

- one target doing two conflicting things
- hidden primary actions
- hover states that imply the wrong action
- controls that appear only on hover with no keyboard/touch equivalent

### Focus and keyboard behavior

- missing initial focus in dialogs
- weak or invisible focus indication
- tab order that does not match the visual flow
- Escape not canceling transient UI
- Enter not committing when expected
- focus not restored intentionally after close or commit

### Editing flows

- edit mode changes layout width or row height
- blur, Enter, and Escape paths fighting each other
- stale values reappearing after save
- selection and rename/edit affordances overlapping
- optimistic updates missing where user intent is already clear

### Layout and responsiveness

- clipping, overlap, or horizontal overflow
- wrong scroll container owning the interaction
- sticky/fixed elements covering content
- long text or empty states breaking the layout
- narrow screens losing controls or context

### Feedback and reliability

- flicker during submit
- duplicate loading states
- server round-trip flashes
- ambiguous save status
- console errors or warnings tied to the flow

## Safe Change Policy

Prefer the smallest change that materially improves the experience.

- Do not rewrite unrelated components.
- Do not re-architect state unless the bug comes from state coupling or transition ambiguity.
- Do not change domain rules unless the current rule is clearly causing the UX failure.
- If you must choose, prefer a simple robust interaction over a clever but fragile one.

## State and Interaction Guidance

When interactive flows are unstable:

- Prefer explicit local state transitions over loosely coordinated handlers.
- Separate commit, cancel, and blur behavior clearly.
- Guard against blur firing after Escape or other cancel paths.
- Batch related state resets to avoid transient invalid UI.
- Restore focus deliberately after closing temporary UI.
- Avoid reactive loops that write back identical-but-new values.

## Inline Editing Guidance

For inline editors:

- Match resting and editing metrics closely.
- Do not let edit mode cause row jump or horizontal shift.
- Keep nonessential hover chrome out of layout flow when possible.
- Separate “open/select” from “rename/edit” when one target currently implies both.
- Prefer immediate local confirmation for low-risk edits once the user has committed.

## Responsive Verification

When a layout or interaction change could vary by screen size, verify at multiple widths.

Minimum expectation:

- narrow mobile
- medium tablet-ish width
- desktop

Check for:

- horizontal overflow
- clipping
- wrapping
- scroll ownership
- sticky/fixed overlap
- long-content behavior
- keyboard and focus behavior where relevant

## Accessibility Verification

At minimum, verify:

- keyboard reachability
- visible focus
- semantic interactive targets where relevant
- sensible accessible names/labels
- dialog focus behavior
- Escape behavior for transient UI
- no critical hover-only dependency without another path

## Verification Matrix

After a fix, verify the exact interaction that mattered.

Examples:

- Enter commits
- Escape cancels
- blur performs the intended action
- focus lands somewhere deliberate
- no unexpected layout shift
- no new console errors
- responsive behavior still works
- hover and non-hover paths both make sense
- touch/keyboard equivalents exist where needed

## Code Validation

After code changes:

- run `pnpm type-check` in `app/`
- run `pnpm lint` when the change is broad enough to justify it
- run any targeted tests that cover the touched interaction if they already exist

If validation cannot be run, say so explicitly.

## Done Criteria

A fix is only complete when all of the following are true:

- the issue was reproduced or otherwise evidenced
- the fix addresses the likely cause
- the live interaction was retested
- before/after evidence was captured when practical
- relevant keyboard behavior was verified
- relevant responsive behavior was verified
- no obvious regression was introduced
- code validation was completed or the limitation was stated clearly

## Handling Blockers

If blocked by environment, auth, backend instability, missing data, or a flaky flow:

- document exactly what was attempted
- separate confirmed findings from suspected findings
- apply safe fixes only where confidence is high
- state what remains unverified

Do not overclaim verification.

## Final Response Format

Summarize the work in this structure:

### Main issues found

- issue
- user impact
- severity

### Fixes applied

- what changed
- why this was the right fix
- whether the fix was local or structural

### Verification performed

- exact interaction retested
- keyboard checks
- responsive checks
- console/error checks
- type-check/lint/test results

### Remaining risks or follow-ups

- anything blocked
- unrelated console errors still present
- areas not fully verified

### Evidence

- clickable screenshot paths for before and after states
- any notable measurements or observations from browser inspection
