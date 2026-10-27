# Note cleanup

Cleanup suggests what to do with notes that have stopped earning their place: distill a copied answer, regroup related notes, summarize an event that has passed, turn a note into a task, revisit a saved link, or delete it. Every action waits for a click. The design and experiment behind it are in [docs/intent/notes-cleanup-decisions](../../docs/intent/notes-cleanup-decisions/ux-decisions.md).

## Assessment

`server/cleanup/` asks a decision model a fixed set of yes/no and choice questions about each note, then picks a bucket in code.

| File                  | Role                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions.ts`        | The question set, the owner profile, and `QUESTION_SET_VERSION`                                                                                                                              |
| `note-state.ts`       | Facts code knows for sure: source (ChatGPT transcript, Notion import, agent, user), word count, latest date in the body and whether it has passed, and the link when the note is only a link |
| `link-check.ts`       | Finds link-only notes (1–3 links, at most 15 other words) and checks whether the link loads                                                                                                  |
| `decide.ts`           | `decide()` adapters for Jev and OpenAI Decisions, normalized to `{p}` / `{choice, probs}` / `{label, probs}`                                                                                 |
| `heuristic.ts`        | Rule-based answers for runs without a vendor key (local, audit databases). Results carry the `heuristic-v1` model name                                                                       |
| `buckets.ts`          | Combines answers into `distill`, `post_event`, `make_task`, `revisit_link`, `delete`, or `keep`, with the probability the queue sorts on                                                     |
| `assess.ts`           | Finds stale notes, asks the questions, and upserts `NoteAssessment`                                                                                                                          |
| `assessment-sweep.ts` | One pass after boot, every six hours, and a minute after any content write                                                                                                                   |

### Saved links

A note that is only a link is usually a breadcrumb: something to come back to, summarize, or try. It is never a stub.

- Before the questions, the sweep fetches the link once per content version and stores `facts.link`: `ok`, `dead` (404, 410, or a host that does not exist), or `blocked` (401, 403, 429, 5xx, a timeout, or any other network error). The decision model sees it as a fact.
- `dead` goes to `delete` with a "Link is dead" signal, and the sweep checks it again each day until you decide, so a site that comes back leaves Delete. A short to-do with a link still goes to `make_task`. Every other link goes to `revisit_link`, links that load first. A `blocked` link never goes to delete, because sites often refuse bots.

A note is stale when it has no assessment, its `contentVersion` changed, or `QUESTION_SET_VERSION` changed. Collection rows, events, and places are never assessed.

### Provider

| `CLEANUP_DECIDER` | Behavior                                              |
| ----------------- | ----------------------------------------------------- |
| unset             | Jev when `TYPESAFE_API_KEY` is set, otherwise off     |
| `jev`             | Jev (`jev-1.14.0`)                                    |
| `openai`          | OpenAI Decisions (`gpt-6-luna`) with `OPENAI_API_KEY` |
| `heuristic`       | Local rules only, no network                          |
| `off`             | No assessment                                         |

Jev costs about $0.11 per 1,000 notes for this question set and answers in ~0.2 s. Rewording a question is a code change: bump `QUESTION_SET_VERSION` and every note is re-asked on the next sweep.

## Archive

Every cleanup action archives the original instead of deleting it (`server/notes/note-archive.ts`).

- `Doc.archivedAt`, `archivedIntoId` (where the content went), and `archiveReason`.
- Archived notes are hidden from the docs index and search, the path tree, Recent, the canvas map, the `[[` link picker, collection pickers, and MCP `search` / `notes_query` / `notes_list_paths`. Opening one by id still works and shows a banner with Restore and a link to where its content went. A new list or search over `Doc` should filter `archivedAt: null` too.
- Links to an archived note resolve to `archivedInto` at read time (`resolveNoteLinks` → `resolveArchiveRedirect` in `archive-window.ts`).
- `/docs/archived` lists the archive, soonest deletion first, with Restore.
- `startArchivePurge` (boot plus every six hours) deletes notes archived more than 30 days ago. Each one leaves a `DocTombstone` with the title and redirect, and notes that pointed into it are re-pointed to where its content went. Opening a deleted note's id follows the tombstone.

To seed an audit database with cleanup archetypes, assessments (heuristic), and three archived notes: `pnpm audit:db -- --owner <slug> --seed-cleanup`.

## Triage page

`/cleanup` (`components/cleanup/`) is the deep-pass view: a bucket rail with counts, the selected bucket's queue sorted by confidence, and the selected note.

- **Why it is here** shows signal chips from `server/cleanup/signals.ts`.
- **Distill**: the draft is written on demand when a note is selected, and only in the browser (never during SSR). `server/cleanup/distill.ts` asks `gpt-5-mini` for JSON bullets plus one snippet. Without `OPENAI_API_KEY` it falls back to a local sentence extract labeled "Local extract". **Review and edit** opens the original beside an editable markdown draft.
- **Send to**: a new note in the source's path, or an existing note in the same area. Appending adds a heading and keeps a `cleanup-append` revision. Both get a "Distilled from …" line. Approving archives the source into the destination (`server/cleanup/apply.ts`).
- **Keep as is** hides the note for six months (`NoteAssessment.snoozedUntil`). **Skip** just moves on.
- Keys: J/K or arrows move, Enter approves, E keeps, S skips. The keys click the visible buttons (`data-cleanup-action`), so the keys and the mouse do the same thing.
- Each bucket gets an action panel in `CleanupDetail.tsx` and a place in `RAIL_BUCKETS`.

## Note chip

A flagged note shows a quiet **Cleanup: <bucket>** chip in its header (`components/cleanup/CleanupChip.tsx`, inside `DocHeaderBar`). Only buckets the triage page can act on get a chip. The popover lists the signals, plus **Review** (`/cleanup?bucket=…&doc=…`) and **Not now**, which snoozes the suggestion for 30 days (`snoozeNote`).

## Regroup

The Regroup bucket holds two kinds of suggestion (`server/cleanup/regroup.ts`, `regroup-queue.ts`):

- **Combine.** After the note pass, the sweep checks each note's embedding neighbors (cosine ≥ 0.8 from the stored vectors, `docNeighbors` in `server/mcp/semantic.ts`). Without vectors it falls back to same-path notes that share a title word. For each pair it asks the pair questions: `relation` (bottom tier "shares words only"), `a_covers_b`, `b_covers_a`, and `better_together`. Results go in `NotePairAssessment`. Pairs at `better_together` ≥ 0.6 are joined with union-find into clusters of 2–6 notes. The default note to keep is the member that covers the most others. The panel lets you untick members, pick the note to keep (or a new note), and review the LLM-written content the others add (or a local merge without a key). Approving appends that content and archives the rest into the kept note.
- **Move.** For an unfiled note, a choice question over existing paths (2+ notes) and collections suggests where it belongs (`NoteAssessment.placement`). When `p` ≥ 0.5, **Move to …** sets the path or adds the note to the collection. Nothing is archived.

## Post-event, make task, delete

- **Post-event.** Code finds a date in the body that has passed, and `time_anchor` says the note is a one-time event or plan. When `evergreen_core` ≥ 0.4, the panel drafts "Keep for next time" with the post-event prompt (`POST_EVENT_FOCUS`). Without a key, a local fallback keeps sections headed like _Packing list_, _Contacts_, or _Next time_. The draft goes to a new or existing note and the original is archived. **Archive without keeping anything** is one click away. Below 0.4 the panel only offers Archive.
- **Make task** (`is_todo` ≥ 0.8, `server/cleanup/make-task.ts`). The panel lists unchecked lines, or short bullets, or the title, as editable Inbox tasks. Checkboxes that are already inline tasks show as "Already tasks" and are detached from the note so they outlive it. Approving creates the new tasks and archives the note.
- **Delete.** Shows what the note holds, or "This note is empty", and archives it. It is deleted after 30 days.

## Revisit link

`RevisitLinkPanel.tsx` and `server/cleanup/link-expand.ts`. When the card opens, the browser asks the server to load the page again. The server reads its text and writes a summary with the distill path and `LINK_FOCUS`. The decision model answers `page_worth_keeping` on the page text (`LINK_QUESTIONS`, not part of the sweep). The panel then offers:

- **Add summary to note**: appends a "Summary" section under the link (with a `cleanup-append` revision). The note stays.
- **Remind me to check it**: adds an Inbox task "Check out <title>: <url>" and snoozes the card for 30 days.
- **Archive**: the primary action when the link is dead or `page_worth_keeping` < 0.3.

A page that refuses the fetch or has little readable text gets no summary, so the reminder is the primary action. **Check again** loads the page again.

## Daily stack

`/cleanup?mode=daily` (`components/cleanup/DailyStack.tsx`, `server/cleanup/daily.ts`) is the maintenance view: one card at a time from a quota of 8 a day across every bucket. Buckets are interleaved round-robin, strongest first, so one bucket can't fill the day. Progress counts the assessments decided today (approved, kept, or snoozed). Each card is the bucket's normal panel plus **Snooze 30 days** (Z). **Skip** (S or →) moves a card to the back for this visit. The **Daily / Deep pass** toggle switches modes.
