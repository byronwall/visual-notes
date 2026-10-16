# TOC Scroll Work Summary

## 1. Scope and context

Reduce TOC geometry reads during note scrolling. Source: commit `3efae6f`, [PR 14](https://github.com/byronwall/visual-notes/pull/14).

## 2. Major changes delivered

`app/src/components/toc/useTocController.ts` caches root-relative heading offsets. One animation frame handles scroll updates and reads the current root rectangle. `range.ts` projects offsets into viewport coordinates. `range.test.ts` covers ancestor and root scrolling.

## 3. Design decisions and tradeoffs

Root-relative offsets survive ancestor movement. The current root rectangle and `root.scrollTop` handle nested scrolling. Mutations, resize, images, fonts, focus, visibility, and root replacement refresh geometry. This avoids a general observer framework.

## 4. Problems encountered and resolutions

Review found stale coordinates after root movement and missed nested scroll events. The controller now captures scroll and projects from the current root position. Type-check first lacked generated Panda files; `pnpm panda` resolved that.

## 5. Verification and validation

On the same 1440×1000 fixture (101 headings, 400 paragraphs, 28,118px), reads fell from 264,000 (375×704) to 432 root-only reads, with zero heading/block reads. Down-sweep frame p95: 16.1→9.4ms; up-sweep: 10→9.7ms. These single runs are load-sensitive. The 381ms original maximum includes 175ms MajorGC; it does not support a broad latency claim. Full lint passed (129 warnings, 0 errors); type-check, two focused tests, and independent review passed.

## 6. Process improvements

Use the same fixture before and after; report read counts separately from frame latency. Browser briefs should name port 3116, server session 92088, test-only auth, protected route, and real action. Record no secrets.

## 7. Agent/skill improvements

Helpers can mistake login pages or hidden controls for valid state. Require protected-route proof and completion of the actual action. Add this to the browser brief template to reduce false passes.

## 8. Follow-ups and open risks

Independent normal hover, track click, visible heading jump, edit/save/reload, resize, and scroll-owner checks passed. The document scrolls the page; the TOC list scrolls separately. Delayed image/font marker accuracy was not checked in the browser. Its invalidation signals passed source review.
