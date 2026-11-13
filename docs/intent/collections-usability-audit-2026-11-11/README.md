# Collections usability audit

**Audit date:** 2026-11-11 · **Source baseline:** `25c7a864947994b8f321ceab73e6b8eae14e3107` · **Scope:** mobile and laptop · **Change type:** audit, product backlog and evidence only.

Collections already has substantial functionality, but the interaction design makes routine reading and reviewing unnecessarily hard. The strongest direction is to retain the fast laptop comparison table while adding a compact narrow-screen record list and a readable full-record detail experience. Fix keyboard escape, visible Open/selection actions and truthful editing feedback before adding more features.

## Read this in order

1. [Likely ideal design](ideal-design.md): task model, responsive shell, laptop/phone interaction contracts and tradeoffs.
2. [Gap analysis](gap-analysis.md): prioritized current-versus-ideal matrix with evidence levels.
3. [Product Grid project](../../../pgm/data/projects/collections-usability/project.json): 19 detailed problem nodes grouped under five areas. Each includes impact, reproduction, proposed work, acceptance criteria, source links and retest IDs.
4. [Evidence register](evidence.md): screenshots, measurements, provenance, coverage and limitations.
5. [Reassessment protocol](reassessment.md): viewport/data/interaction matrix and a repeatable sign-off record.
6. [Reference register](references.md) and [work summary](work-summary.md): standards, repository context and verification.

[Machine-readable issue index](issue-index.json) provides stable CU IDs and node paths. The PGM nodes are the canonical place to update implementation status and fixed-commit evidence. Existing Pathways PGM content is unchanged.

## Main findings

- **Phone layout is dominated by navigation and frozen identity.** In the 390×844 component fixture, 15 views occupy 487px and the table begins at y=735 in the app viewport. Frozen selection/title consume 312px. The runner's classic scrollbars leave just 16px of non-frozen data area; overlay-scrollbar arithmetic leaves 46px with the route's padding.
- **Laptop is better, but still obstructs the review task.** At 1280×800, the view tabs wrap to 102px and the 1,796px table exceeds its 1,186px internal viewport. Important long-copy fields start offscreen. Existing frozen identity and header help comparison, but they do not solve full-text reading.
- **Opening and editing have the wrong emphasis for review.** Title click enters rename; Open is hidden until hover/focus. Plain long-text properties remain truncated even in the actual PropertyList component, and editing uses a single-line input.
- **Tab boundary navigation is broken.** In the actual table component, repeated Tab on the last cell stays in the last column, and Shift+Tab on the first stays in the first column.
- **Selection breaks the narrow toolbar.** The phone bulk strip wraps long labels into a fixed height, overlaps the existing toolbar, and puts Clear selection beyond the document client edge.
- **Save, validation and gesture risks need integration proof.** Source review identifies silent invalid-number rejection, whole-row rollback after a property-write failure, confusing view-save persistence and touch/drag conflicts. These are labelled separately from browser-reproduced findings.

## Evidence boundaries

The deployed URL opened at a sign-in screen. No authenticated deployed UI or private production note was changed. Browser images show actual source components at the pinned revision using synthetic data and mocked server actions, with the global app shell omitted. The full RowPeekPanel/note editor is replaced in the fixture by a labelled isolated actual PropertyList inside the actual SidePanel. Consequently, images prove component behavior and geometry under the stated conditions, not deployed persistence, full note-body behavior, shell/sidebar fit or SSR/hydration.

The workload uses 110 synthetic records, eight mixed properties plus title, and 15 long saved-view labels to stress an established review pattern. Private note text, identifiers and account content are excluded. View configurations and widths in the fixture are explicit defaults, not a claim about a user's saved production configuration.

## Priorities and recommended sequence

- **P1:** Task blockers or serious recurring interaction risk. Fix narrow layout/navigation, full-text detail, visible open/selection, grid escape and editing/validation safety. Reproduce reliability risks with controlled failures before implementing a speculative fix.
- **P2:** Important comprehension, throughput and capability refinements. Clarify view persistence, result counts, schema scope, card labels, creation/import, calendar presentation and column sizing.
- **No P0 claimed:** No verified production outage, irreversible loss or critical corruption was found. This is not a safety certification.

Suggested slices: (1) keyboard/validation defects; (2) readable detail and visible Open; (3) responsive views/table/selection; (4) safe persistence and context; (5) alternate views and input completeness. Each slice should retain the existing features listed in the ideal brief and attach before/after proof for both phone and laptop conditions.
