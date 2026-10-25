# UX decisions: note cleanup

Decided with Byron on October 24, 2026, after three rounds of questions and four mockups. This builds on the product shape in [results.md](results.md). Mockups were generated as layout references only. They are not checked in.

## Goal

Cleanup should shrink the notebase, not just annotate it. When Byron confirms an action, the original note is archived. Any durable content moves into a new note or an existing one, whichever fits better.

## Principles

- **Nothing happens without a click.** The decision models only rank and group. Every action is a suggestion until Byron approves it. Even obvious cases like blank voice notes are not auto-applied.
- **Two rhythms.** First, a long initial pass where Byron works through hundreds of notes in one sitting. After that, quick but thoughtful daily or weekly maintenance.
- **Archive first, delete later.** Approving an action archives the original. Archived notes are deleted automatically after 30 days.

## Surfaces

### Triage page (deep pass)

A `/cleanup` route with three panes:

| Pane | Contents |
| --- | --- |
| Left rail | Buckets with counts: Distill, Regroup, Post-event, Make task, Delete. Below a divider: Archived, with a count and "auto-delete after 30 days" |
| Middle | Notes in the selected bucket, sorted by confidence. Each row has the title, source, date, word count, and a thin confidence bar |
| Right | The selected note: a **Why it is here** box with signal chips (`copied_or_generated 0.94`, `Source: ChatGPT transcript`, `No views in 90 days`), the proposed result (bullets for a distill), and **Send to**: a new note in a path, or an existing note |

Actions: **Distill and archive original** (primary), **Keep as is**, **Skip**. It is keyboard-first: `D`, `K`, `S`, and `J`/`K` to move between notes.

To edit a draft before approving, open the side-by-side review. It shows the original on the left with the durable passages highlighted, and the editable distilled result on the right. Each distilled bullet links back to its source passage. A destination control offers New note, Append to existing, and Combine with others. A footer reads "Original moves to Archive · deleted automatically after 30 days". This review is optional. The default path is to approve from the 3-pane view.

### Daily stack (maintenance)

A **Daily** / **Deep pass** toggle on the same route. Daily mode shows one card at a time, with actions of mixed types and a small daily quota ("Today: 3 of 8 · about 2 min left"). Each card shows what is kept and what is dropped. For example, a post-event card keeps the packing list and contacts and drops the carpool schedule and RSVPs. Card actions are approve, **Keep as is**, **Snooze 30 days**, and **Open note**. Keys are `Enter`, `K`, `Z`, and `→`. Upcoming cards appear as muted chips below.

### Inline on a note

A flagged note gets a quiet **Cleanup: distill** chip next to its title. It does not use a banner or a footer card. The chip's popover shows the top signals plus **Review** (which opens the triage view on that note) and **Not now**.

## Actions

| Action | Behavior |
| --- | --- |
| **Distill** | An LLM drafts the durable facts **on demand** when a note is selected. Add prefetching only if the wait becomes a blocker. On approval the result goes to a new or existing note, and the original is archived |
| **Regroup: combine** | Suggested clusters, such as "5 CSS motion notes", built from embedding neighbors plus the pair questions. On approval the notes are merged into one and the rest are archived. There is no manual multi-select combine for now |
| **Regroup: move** | Files a note into an existing collection or path (prompts, journal, tidbits) without rewriting it |
| **Post-event** | Keeps the evergreen part (merging it into an existing note when one fits) and archives the rest |
| **Make task** | Creates a task from the note and archives the note |
| **Delete** | Rare: empty notes, stubs, and notes not worth reading. Still goes through archive first |
| **Keep as is** | Hides the note from cleanup for 6–12 months, then asks again |
| **Snooze** | Hides the note for 30 days (daily stack) |

## Archive lifecycle

Archived notes:

- are hidden from default search, the path tree, lists, and related notes.
- **redirect**: links and backlinks to an archived note open the note it was distilled or combined into.
- appear on an **Archive page** with days left before deletion and a **Restore** button.
- are deleted automatically after 30 days, leaving a **tombstone** (title, date, and where the content went) so old links still resolve.

## Scope

- Every regular note is sent to the decision models. There are no path-based privacy exclusions.
- Collection rows, events, and places are excluded. Their value is in the structured record, not the note body. Collection rows should not show up as standalone notes in the first place.

## Open

- Daily quota size, and whether a Today-page widget or notification should prompt the daily stack.
- Cluster size limits and the merge-draft UI for combine. This probably reuses the side-by-side review with several sources.
- Whether the 30-day window can be configured.
