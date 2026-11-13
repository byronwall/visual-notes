# Likely ideal design for Collections

**Proposal, not a validated final design.** Keep the existing notes-native model and fast laptop table. Add a clear reading and reviewing experience that fits narrow containers. The primary job is to find a record, understand its values and note body, change something confidently, and return to the same context.

## What to preserve

The [original intent](../collections/intent-brief.md) requires first-class notes, spreadsheet-quick editing, saved table/board/gallery/calendar views, and editable collection embeds. Current source already includes frozen row identity and headers, horizontal overflow cues, resizing/reordering/hiding properties, filtering/sorting, bulk operations, row windowing, full-note peek, and a note-body dirty-close guard. These are foundations to improve, not missing features to rebuild.

Do not introduce a second record identity, duplicate datasets for mobile, relations/formulas, or a broad spreadsheet redesign. Removing membership and deleting a collection must continue to preserve note bodies. Deleting a row/note remains a distinct action.

## Shared shell and view navigation

- Show collection name, current view, visible/total record counts and one clear New action. Use “5 shown · 110 total” when constrained. Keep Add existing notes distinct from New.
- Use a bounded view strip with searchable overflow on laptop, and a compact active-view selector on narrow screens. Selecting a view and editing its name/layout should be distinct actions.
- Keep search and active filters/sorts visible. Put low-frequency schema and presentation controls behind labelled settings. Do not spend most of the first phone screen on wrapping view tabs.
- Adapt to actual container width, including sidebars, embeds, browser zoom and a detail pane. A desktop-sized device can still have a narrow content region. Resizing must not remount an active editor and lose its draft.
- Allocate the remaining content region from measured layout, not a constant assumption about header height. Menus must fit the viewport and remain attached to their trigger, including inside sticky content.
- Make persistence explicit. Either retain autosave with a visible state and reset/undo, or use temporary exploration with Save view / Save as new. Do not silently mix temporary search and persistent filter/config changes without signalling the difference.

## Laptop comparison and editing

Retain a table with sticky headers and identity. Choose sensible initial widths by content/type; let users resize and hide columns. Cap frozen identity relative to available width so it cannot obscure the active property. Scrolling belongs inside the table, with useful edge cues and keyboard access.

Compact rows can stay single-line for fast comparison, but each has a visible full-value/record path. A comfortable density can offer two or three lines only if virtualization handles those heights correctly. Do not assume replacing fixed-height windowing is free.

Opening an existing note should be obvious. Preserve rapid rename via an explicit edit affordance or Enter/F2. If click-to-edit remains, Open must be visible without a hover hunt. Distinguish row hover, nested link hover, selection and edit states.

A detail pane is useful only when enough comparison space remains. At 1024–1280px, a full-width/modal detail may be clearer than squeezing a table beside 720px. At larger widths, preserve collection context and offer next/previous in the filtered order.

## Phone browsing and reviewing

Default to a compact record list for reading/review: wrapping title plus two to four configured, labelled properties. Keep each record bounded. Do not expand all eight or twenty fields into enormous repeated cards. Do not hardcode a feedback workflow's property names.

Tap the primary record target to open full-width detail. All properties remain available there, including hidden summary fields and empty review fields. Keep link, selection and edit targets separate. Offer explicit Table mode for genuine comparison, with a smaller or released frozen title region.

Long fields belong under their labels, using wrapping text and multiline editing. Short values can remain compact label/value rows if they fit. Keep Back/Close and save/error state visible, including above the software keyboard and device safe areas. Large filters/settings may use a sheet; simple selectors need not become full-screen automatically.

## Record editing and navigation contract

1. Read full title, long text, URL/source and note body without entering edit mode just to reveal text.
2. Edit with the property's actual type. A select named Rating remains a select; numeric stars are a separate supported format. Opening a link and editing its address are distinct actions.
3. Enter inserts a newline in multiline text. Escape cancels the local draft. Invalid input stays visible with an associated textual error. A closed editor is not a substitute for a successful save.
4. Make dirty, saving, saved and failed distinguishable when consequential. Retain recoverable drafts on failure. Do not promise offline durability without durable storage.
5. Prevent stale failures from rolling back newer successful edits. Test per-property edits independently of the existing note-body save guard.
6. Return to the originating view, filter/search, scroll and focus. Support a record deep link and optional next/previous within the current results. If an edit removes a row from the filter, explain it and let the user finish rather than yanking the record away.
7. Bulk selection says what is selected. Keep Clear/Done reachable. Explain Remove from collection versus Delete notes and preserve existing confirmations.

## Other views

- **Board:** preserve groups and optional ordering. Native touch scrolling should not become accidental dragging. Offer clear non-drag move/group actions; an explicit handle or deliberate press can enable drag.
- **Gallery:** useful when imagery matters. Prefer text-first cards/no cover when it does not. Label ambiguous properties and expose configured empty review fields instead of silently omitting them.
- **Calendar:** keep laptop month context. Provide agenda/day-list presentation for narrow screens, readable event targets, visible Add and accessible rescheduling. Every undated row must remain reachable beyond the first page.
- **Embeds:** preserve independent saved-view configuration and clear links to the parent collection. Narrow embeds need the same container-based layout rules; schema editing can remain intentionally restricted.

## Accessibility and quality constraints

Use the [reference register](references.md) for primary guidance. A real two-dimensional table may scroll horizontally under WCAG reflow exceptions; that does not excuse overflowing surrounding controls or unreadable individual values. WCAG AA target size is 24×24 CSS px subject to exceptions. Choose 44×44 for primary phone controls as a comfort goal, not an incorrect AA claim.

An interactive ARIA grid is appropriate only with a complete keyboard model, managed focus, accurate semantics and a way to leave it. A native table is preferable for a non-interactive comparison surface. Verify screen-reader behavior, focus visibility, modal containment and focus return. Provide click/tap alternatives for essential drag actions. Use text and state semantics in addition to color.

## Decisions to validate with use

- Compare a compact list, explicit narrow table, and existing gallery on the same review and comparison tasks. Measure completion time and errors rather than choosing a familiar visual style by taste.
- Choose autosave versus explicit view-save behavior consistently; both have costs.
- Choose the detail-pane breakpoint from usable remaining width, not the device label.
- Treat content-aware column defaults and density presets as refinements after opening, reading, editing and keyboard escape work reliably.

The [reassessment protocol](reassessment.md) defines tasks, fixtures and pass criteria. This brief is a testable hypothesis, not user research or a pixel-perfect specification.
