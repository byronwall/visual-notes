# Collections audit reference register

Reviewed 2026-11-11. External standards support requirements; they do not establish whether this application passes or fails. The ideal design is a proposal grounded in current source and task shape, not a comparative study or measured user research.

## Product sources

- [Collections intent](../collections/intent-brief.md): rows are notes, spreadsheet-quick editing, saved views and editable embeds.
- [Collections shape](../collections/shape-brief.md): data/membership guarantees and original scope.
- [Implementation plan](../collections/implementation-plan.md): historical milestones; do not treat completed milestone labels as proof of current usability.
- [Repository UI standards](../../../CODING_STANDARDS.md): responsive floating content and distinct row/nested interactive states.
- [Audit harness](../../../app/docs/audit-harness.md) and [browser checks](../../../app/docs/browser-checks.md): isolated data, provenance and repeatable evidence.
- [Existing peek guard regression](../../../app/tests/e2e/collection-peek-guard.spec.ts): preserve note-body save protection while extending property/navigation behavior.
- [PGM report](../../../app/scripts/pgm-report.ts): node/evidence consistency checks.

Source baseline: [`25c7a864947994b8f321ceab73e6b8eae14e3107`](https://github.com/byronwall/visual-notes/commit/25c7a864947994b8f321ceab73e6b8eae14e3107). Every problem node links to its relevant files at that immutable revision. Use anchors/symbol names rather than assuming line numbers still match after a fix.

## Primary accessibility and interaction guidance

| Source                                                                                            | Application to this audit                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)                        | Tables can need two dimensions; surrounding chrome and individual text still need to reflow. Horizontal table scrolling alone is not automatically a failure. |
| [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)       | AA 24×24 CSS px or permitted spacing/exception. The proposed 44px primary phone target is a comfort goal.                                                     |
| [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Sticky identity/header, sheets and bulk bars must not hide focused content.                                                                                   |
| [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)         | Essential drag actions need single-pointer alternatives; keyboard alone is not the same requirement.                                                          |
| [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)               | Announce useful results and save failures without stealing focus.                                                                                             |
| [Error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)     | Keep invalid input understandable and correctable with textual explanation.                                                                                   |
| [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)           | Measure meaningful controls/state indicators; do not infer contrast conformance from screenshots.                                                             |
| [WAI table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)                              | Prefer native table semantics for non-interactive tabular content.                                                                                            |
| [WAI grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)                                | Spreadsheet grid requires complete keyboard/focus behavior and row/column semantics.                                                                          |
| [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)                | Detail/sheet needs name, contained focus, dismissal and return focus.                                                                                         |
| [USWDS table guidance](https://designsystem.digital.gov/components/table/)                        | Choose scrollable versus stacked/list presentation by task and content; both have tradeoffs.                                                                  |

No blanket WCAG compliance assessment is claimed. Contrast, real-device assistive technology, deployed route history and network persistence need separate verification.
