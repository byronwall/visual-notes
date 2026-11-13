# Collections reassessment protocol

Use this to reassess after fixes without repeating the discovery work. A screenshot alone is not an interaction pass. Keep source-confirmed risks separate from reproduced defects and do not mark a node implemented solely because the code changed.

## Run identity and safe data

1. Record commit SHA, branch, browser/version, OS/device, CSS viewport, zoom, sidebar state and collection content width. Note whether this is authenticated deployed UI, full isolated app, or a component fixture.
2. Prefer the repository's [audit harness](../../../app/docs/audit-harness.md) with an isolated synthetic database. Never write to the real notes database for an audit. Use returned fixture IDs and the harness manifest for cleanup.
3. Capture evidence with [browser-checks](../../../app/docs/browser-checks.md) and `pnpm audit:shoot`. Keep session files and traces with credentials out of git. Inspect actual pixels before calling visuals verified.
4. This audit's committed images use actual components with synthetic data and mocked backend actions. They are a reproducible layout/interaction baseline, not evidence of deployed saves, authentication, SSR or full-note editor behavior. See [evidence.md](evidence.md).

## Minimum test matrix

| Dimension            | Required coverage                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Phones               | 320×568, 390×844, 430×932; portrait and landscape; coarse pointer                                                                       |
| Tablet/narrow laptop | 768×1024, 1024×768                                                                                                                      |
| Laptops              | 1280×800, 1366×768, 1440×900; sidebar open and collapsed; detail open/closed                                                            |
| Magnification        | 200% browser zoom and reflow equivalent of 320 CSS px                                                                                   |
| Real hardware        | At least Safari on iOS and Chrome on Android for software keyboard, scrolling, drag cancellation and safe areas                         |
| Assistive input      | Keyboard only plus one desktop screen reader and VoiceOver/TalkBack for affected interactions                                           |
| Containers           | Standalone collection, narrow embedded view, note detail property list                                                                  |
| Data sizes           | Empty, one, five filtered out of 110, 110, 300, 2,000 rows; windowing starts above 150                                                  |
| Schema               | Eight mixed properties + title; 20+ property stress case; select Rating separate from numeric star format                               |
| Values               | Long/multiline plain text, 200-character unbroken URL, long title/options, empty values, dates/ranges, readonly values, invalid numbers |
| Views                | 1, 5, 15, 30 saved views, with long labels                                                                                              |
| Network              | Fast, slow, failed write, failed read, offline, out-of-order overlapping requests                                                       |

The representative dimensions are not device-specific guarantees. Do not mark unrun cells as passing.

## Repeated tasks and pass criteria

| Test                   | Actions                                                                                                           | Pass condition                                                                                                          | Nodes         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| R01 Layout budget      | Open 15-view collection at every width, scroll page/table independently, resize while editing                     | Navigation is bounded; first useful records remain accessible; no unintended page overflow or draft loss                | CU-01, 02     |
| R02 Read and compare   | Identify same row across first/last columns; change widths; open record without renaming                          | Every property reachable; focused value not hidden by frozen identity; intentional open/edit targets                    | CU-01, 04, 18 |
| R03 View navigation    | Choose late view, open settings, rename, duplicate, cancel/delete only synthetic view; Back/Forward               | All views reachable, active one clear, switching distinct from editing, state preserved                                 | CU-02, 08     |
| R04 Review a batch     | Open row 3 of five, read full text/source, edit feedback, next, close and return                                  | Full text readable; correct record edited; context and focus restored                                                   | CU-03, 04, 14 |
| R05 Keyboard grid      | Tab/Shift+Tab at each boundary, arrows, Enter/F2, Escape, nested links/pickers, screen reader                     | No trap; documented edit/navigation modes; meaningful row/column announcements and visible focus                        | CU-05, 10     |
| R06 Targets and sizing | Measure actual boxes/spacing; set/clear numeric stars; resize columns with touch and keyboard                     | AA size/spacing or documented exception; agreed primary 44px goal; complete rating semantics; no tiny-handle dependency | CU-06, 18     |
| R07 Bulk operations    | Select one/all, filter while selected, open actions, cancel remove/delete, clear                                  | Count/scope accurate; all controls reachable; no unintended note deletion                                               | CU-07         |
| R08 Edit reliability   | Enter invalid text/number, cancel; hold A, commit B then reject A; close/reopen/route away during save            | Draft recoverable, no false success, stale failure never overwrites newer success; body guard retained                  | CU-03, 09, 19 |
| R09 State explanation  | Empty collection, search+filter no matches, clear one/all, fail view save, reload                                 | Clear distinction between empty/hidden/failed; truthful counts and persistence; useful recovery                         | CU-08, 15     |
| R10 Windowing          | 300/2,000 rows, keyboard beyond rendered window, bottom/up, filter to five                                        | Actual table scroller reveals requested row before focus; no page jump, blank window or lost edit                       | CU-10         |
| R11 Calendar           | Busy month, ranges, long titles, 101 undated rows, keyboard Add/move                                              | Readable narrow presentation, every row accessible, no-drag date changes                                                | CU-11         |
| R12 Gestures           | Swipe on cards/events, drag/drop, pointercancel, Escape, interrupted route, non-drag move                         | Scrolling does not change data; cancellation fully cleans up; essential actions available without dragging              | CU-12         |
| R13 Cards              | Two ambiguous text properties, empty review field, no cover, no matches                                           | Labels visible without hover, relevant empty fields findable, text-first density, explicit no-results                   | CU-13, 15     |
| R14 Context            | Detail → URL → return, reload, Back/Forward, next/previous, edit row out of filter                                | Defined context/deep-link behavior; no unannounced disappearance or lost draft                                          | CU-14         |
| R15 Schema scope       | Tap property label/value, hide vs rename/type/delete, embedded version                                            | Scope explicit; row edit cannot accidentally look like collection-wide configuration                                    | CU-16         |
| R16 Create/import      | Start from non-empty index, long name, software keyboard, search/path filters, selection across reopen, move note | Forms reflow; clear cancellation; accurate selection and mapping explanation; body preserved                            | CU-17         |
| R17 Validation         | Invalid number → Enter, blur, Tab, correction, Escape                                                             | Input remains correctable with an inline explanation; successful commit and cancel are distinct                         | CU-19         |

Use controlled interception only against the isolated app for R08/R09. Verify persisted values after reload, not just optimistic UI. Repeat significant flows twice and include rapid repeated actions, dismissal and newer navigation.

## Reassessment record

For every changed node add a dated section with:

- **Fix:** PR and exact commit.
- **Evidence level:** component fixture, full isolated app, deployed browser, device test, source only.
- **Conditions:** viewport/content width, browser, input method, fixture size/schema/view count.
- **Steps and result:** observed behavior, not “looks good.”
- **Before/after:** named images and any focused trace/log without secrets.
- **Checks:** passed, failed, skipped or not run. Link each requirement to proof.
- **Disposition:** fixed, partially fixed, still open, duplicate, or design decision; record residual limitations.

Keep node status `planned` until work begins. Use `working`, `needs-review` or `blocked` as appropriate. When truly fixed, use `implemented` and add `metadata.solution` with the implementation/evidence link so the repository's PGM consistency report can validate it. Preserve the original observation and baseline instead of rewriting history.

## Repository checks

From `app/`, run the existing checks one at a time:

```sh
corepack pnpm lint
corepack pnpm type-check
corepack pnpm test
corepack pnpm pgm:report --root ../pgm/data --project collections-usability --repo-root .. --json
```

For application fixes, also run focused Collections unit tests, the affected browser regressions and a production build as required by repo guidance. PGM/docs-only validation does not prove a UI fix. Verify CI for the final pushed SHA. Keep screenshot fixture scaffolding clearly separated from application implementation; do not substitute a static mockup for actual UI evidence.
