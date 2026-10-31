# Usability audit ledger (October 31, 2026)

This ledger lists every usability finding from one browser audit of Visual Notes. Each batch is one fix worker's scope.

## Method and limits

- **Build:** production build of `main` from the audit harness, port 3348, on a synthetic database. No production data was read or changed.
- **Data:** 6,000 seeded notes, 8 research fixtures, 180 synthetic archive pages, and tasks, collections and events made through the UI.
- **Input:** Playwright with real clicks and keys, at 1440, 1200, 1024, 800 and 390 px.
- **Cleanup data:** `CLEANUP_DECIDER=heuristic` fills the queues without paid calls. This needed a local harness edit, and that edit is not in this PR (row CL8).
- **Timing limit:** the app ran on loopback, so desktop times do not include network delay.
- **Compression limit:** the harness sends files uncompressed. The phone load times in L1 are a worst case, and the real site may be faster. Repeat visits were not measured.
- **Not tested:** real iOS Safari, audio recording, Canvas and UMAP with real data, Time Blocks (issue #263), and phone task entry (PR #271).
- **Seeded text:** some findings use my own typed test strings. The behavior is what the row records, not the string.

Sources for "evidence" are the check scripts in `app/tmp/audit/` and their screenshots. Those files are not committed.

Files are relative to `app/src/` unless the row says otherwise.

## Severity

| Value | Meaning |
| --- | --- |
| Blocking | Text or data is lost, or the job cannot be done at that width |
| Slowing | The job works, but with extra steps or a wrong turn |
| Trust | The screen is wrong or unclear, but the job still works |
| Polish | A small visual or wording defect |

## Batches, in value order

| Batch | Name | Rows | Owned files | Order |
| --- | --- | --- | --- | --- |
| B1 | Note text is never lost | N1–N7 | `components/NewNoteModal.tsx`, `components/DocumentEditor.tsx`, `components/doc-header/DocSaveStatus.tsx`, `components/ui/simple-dialog.tsx` | First. No dependency |
| B2 | Research layout at normal widths | R1–R5 | `components/research/board/TopicBoard.tsx`, `components/research/board/OptionsTable.tsx`, `components/research/ResearchTopicPage.tsx`, `components/research/inspector/TopicContents.tsx`, `routes/research/[slug].tsx` | Any time |
| B3 | Search finds things, and Enter opens them | P1–P4 | `components/CommandKMenu.tsx`, `components/command-search.ts`, `components/command-palette/*`, `app.tsx` | Any time |
| B4 | Tags and paths | T1–T6 | `components/editor/extensions/TagSuggestion.ts`, `components/PathEditor.tsx`, `components/PathRelatedNotesPopover.tsx`, `components/NearbyNodesPopover.tsx`, the path normalizer that `PathEditor` calls | Any time |
| B5 | Cleanup at every width | CL1–CL9 | `components/cleanup/CleanupWorkspace.tsx`, `components/cleanup/CleanupQueueList.tsx`, `components/cleanup/CleanupDetail.tsx`, `components/cleanup/CleanupActionBar.tsx`, `components/cleanup/ArchiveOnlyPanel.tsx`, `components/cleanup/CleanupRail.tsx`, `components/cleanup/CleanupRunStatus.tsx`, `app/scripts/audit-harness.ts` | Any time |
| B6 | Task editing and task history | TK1–TK3 | `components/tasks/TaskRow.tsx`, `components/tasks/TaskTreeContext.tsx`, `components/tasks/TaskQuickAdd.tsx`, `components/tasks/createTaskActions.ts`, `services/tasks/tasks.actions.ts`, `server/tasks/task-store.ts` | Start after PR #271 merges. It changes the same task files |
| B7 | Research map and card editing | M1–M4, C1 | `components/research/map/*`, `components/research/detail/CardEditForm.tsx`, `components/research/detail/CardDetailPanel.tsx` | After B2, so the map is checked in the final layout |
| B8 | Collections entry | CO1–CO4 | `components/collections/views/CollectionToolbar.tsx`, `components/collections/CollectionViewHost.tsx`, `components/collections/RowPeekPanel.tsx`, `components/collections/membership/AddNotesDialog.tsx`, `components/collections/board/CollectionBoard.tsx`, `components/collections/table/CollectionTable.tsx` | Any time. It uses the `initialFocusEl` prop that `SimpleDialog` already has, so it does not touch B1's file |
| B9 | Events entry | E1–E4 | `components/events/note/*`, `components/events/views/UpcomingList.tsx`, `components/events/views/EventsPageShell.tsx` | Any time |
| B10 | Shell, Activity and Explorer rows | S1–S2, A1–A3, AR1–AR2, CH1 | `components/sidebar/AppSidebarLayout.tsx`, `components/research/ResearchTopicIndex.tsx`, `components/activity/ActivityEventRow.tsx`, `components/activity/ActivityToolbar.tsx`, `components/DocActivitySummaryPopover.tsx`, `components/archive/list/ArchiveListRow.tsx`, `components/archive/ArchiveDetailDrawer.tsx`, `components/ai/LLMSidebar.tsx` | Any time |
| B11 | First load weight | L1–L3 | `app/vite.config.ts`, `components/archive/list/ArchiveList.tsx`, `routes/archive/index.tsx` | Last. It is the largest and least certain batch |

Each batch fits 1 to 2 hours. No file is in two batches.

## Ledger

### B1: Note text is never lost

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N1 | New note dialog | Esc closes the dialog and drops typed text with no prompt. Backdrop click is already safe, so Esc is the gap. | Click New note. Type a title and body. Press Esc. Open New note again. | Dialog count 0 after Esc. Reopened dialog shows "Untitled note" and no body. After a backdrop click the dialog count stays 1. | Blocking | B1 | `NewNoteModal.tsx`, `ui/simple-dialog.tsx` |
| N2 | Note autosave | A failed save never retries. The status stays red after the network returns, and a reload loses the text. | Open a note. Go offline. Type. Wait 4 s. Go online. Wait 12 s. Reload. | "Couldn't save · Retry" at 4 s and still at 12 s after reconnect. Text is gone after reload. | Blocking | B1 | `DocumentEditor.tsx`, `DocSaveStatus.tsx` |
| N3 | Note autosave | Leaving a note with a failed save shows no warning. The `/docs/new` draft has a "Leave without saving?" dialog, but a saved note in the error state does not. | Open a note. Go offline. Type until the save fails. Click Tasks. | The tab went to `chrome-error://chromewebdata/` with no prompt (1 of 1). The typed text did not persist. | Blocking | B1 | `DocumentEditor.tsx` |
| N4 | Note autosave | When the session ends, the status says "Retry", but a retry cannot work and nothing says to sign in. | Open a note. Clear cookies. Type. Wait 4 s. | Save returns 401. Status shows "Couldn't save · Retry". The URL does not change. | Slowing | B1 | `DocSaveStatus.tsx` |
| N5 | New note dialog | No key creates the note. The hands must leave the keyboard or Tab through the fields. | Open New note. Type. Press Cmd+Enter, then Cmd+S. | Dialog stays open and the URL stays `/` for both keys. Fix: Cmd+Enter and Cmd+S both create the note. | Slowing | B1 | `NewNoteModal.tsx` |
| N6 | New note create | After Create, focus falls to `body`. The next keystroke goes nowhere. | Create a note from the dialog or `/docs/new`. Type at once. | Create takes 459 ms. Then `document.activeElement` is `BODY`. Fix: put the caret at the end of the note. | Slowing | B1 | `DocumentEditor.tsx` |
| N7 | `/docs/new` | A click below the title puts the caret in the body. The note then saves as "Untitled note", and the page shows two title lines. | Open `/docs/new`. Click the lower part of the editor. Type one line. Click Create note. | Tab title "Untitled note • Visual Notes". The page shows "Untitled note" over a grey "Untitled" heading. The first line of text is not used. Fix: when the heading is empty, use the first line as the title and show one title line. | Trust | B1 | `DocumentEditor.tsx` |

### B2: Research layout at normal widths

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Topic Board | The Answer block collapses, and its text stacks one letter per line. It happens at laptop widths with the inspector open. | Open a topic with 2 criteria at `?view=board`. Use a width of 1200 px. | Answer width: 93 px at 1280, 13 at 1200, 0 at 1100, 0 at 1024, 125 at 960, 65 at 900, 0 at 800, 121 at 700, 21 at 600. It is correct at 1440 only. | Blocking | B2 | `board/TopicBoard.tsx` |
| R2 | Topic on a phone | The inspector is always open at 45dvh. The Board or Options view gets about 350 px of 844 px. | Open any topic at 390 px. | Inspector starts at y≈513. Code sets `h: { base: "45dvh" }`. Fix: closed by default below `lg`, and open when a card is picked. | Slowing | B2 | `ResearchTopicPage.tsx` |
| R3 | Inspector Contents | A long question heading is centered, wraps, and its second line draws over the row below. | Open `/research/car-insurance-renewal-comparison`. Look at the first group in Contents. | "PRICE?" overlaps "Match the renewal coverage". Fix: left align and let the heading take its own height. | Trust | B2 | `inspector/TopicContents.tsx` |
| R4 | Options table | The Stream column repeats one long value in every row and is cut at the right edge. | Open a one-stream topic at `?view=table`. | The text ends at "actually wa" with no wrap, no ellipsis and no scroll. Fix: hide the column when there is one stream, and wrap it otherwise. | Polish | B2 | `board/OptionsTable.tsx` |
| R5 | Topic page title | Every topic has the same browser tab title. | Open two topics in two tabs. | Both read "Research • Visual Notes". Fix: use the topic title. | Polish | B2 | `routes/research/[slug].tsx` |

### B3: Search finds things, and Enter opens them

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Cmd+K | **Fixed in PR #274.** Enter on a search opens a new note, not the best match. The "New note" action is row 0 and stays selected when results arrive. | Press Cmd+K. Type "Audit capture", which matches a note exactly. Press Enter. | The New note dialog opens with the title "Audit capture". Fix: when results exist, select the first result. Keep Cmd+D for New note. | Blocking | B3 | `CommandKMenu.tsx`, `command-search.ts` |
| P2 | Cmd+K | **Fixed in PR #274.** Search covers notes and collections only. Tasks, research topics and archive pages return nothing. | Press Cmd+K. Search for a task title, a topic title and a saved page title. | "Fix the gate", "printer" and "Saved page 3" all show "No results." Fix: add one result group each for tasks, topics and saved pages, with the same search the MCP `search` tool uses. | Slowing | B3 | `CommandKMenu.tsx`, `command-search.ts`, `command-palette/*` |
| P3 | Global error overlay | **Fixed in PR #274.** A failed search request replaces the app with a full-screen "Something went wrong" dialog. | On any page, go offline. Press Cmd+K. Type. | Overlay text is "Failed to fetch", and the page behind it is hidden. Fix: show the error in the palette results and keep the page. | Trust | B3 | `app.tsx`, `CommandKMenu.tsx` |
| P4 | Cmd+K layout | **Fixed in PR #274.** Two select controls and a "No matching paths" line sit above the results. | Press Cmd+K. Type a word. | First row starts about 165 px below the dialog top. On a phone, only 3 results fit. Fix: hide the path line when there is no match, and move sort into one small control. | Polish | B3 | `CommandKMenu.tsx`, `command-palette/PalettePathChips.tsx` |

### B4: Tags and paths

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Note editor tags | A tag typed at normal speed stays plain text and is not indexed. Only a pick from the menu makes a tag. | Type `A line with #trialtag and more`. Open `/tags/trialtag`. | "0 blocks", "No blocks carry this tag." `/tags` showed "No tags yet." `#picked`, chosen with Enter, is indexed. Fix: add an input rule that makes a tag when a space follows `#name`. | Blocking | B4 | `extensions/TagSuggestion.ts` |
| T2 | Path popover | On open, focus lands on a suggestion button, not the input. Typed text is lost. | Click Edit path on a note. Type "work". | Focus is on `BUTTON audit`. Input value is `""`. Fix: focus the input on open. | Slowing | B4 | `PathEditor.tsx` |
| T3 | Path popover | Enter does not save. Esc then drops the edit. | Open Edit path. Click the input. Type a segment. Press Enter twice. Press Esc. | The Save button is still shown after two Enter presses. The path is unchanged after Esc. Fix: Enter on an empty segment saves. | Slowing | B4 | `PathEditor.tsx` |
| T4 | Path popover | Bad paths are accepted, so spaces, `#` and `!` reach the list. | Set the path to `Bad Segment!`, or type a sentence with `#`. | "Body line one #audittag" was saved as a path. It shows as a chip on Notes. Fix: normalize a segment as it commits, and show the result. | Trust | B4 | `PathEditor.tsx`, the path normalizer |
| T5 | Related notes popover | The path shows as a large blue monospace heading, far bigger than the content. | Click Related notes on a note. | Heading text is about 24 px in a popover with 14 px rows. Fix: use the normal label size. | Polish | B4 | `PathRelatedNotesPopover.tsx` |
| T6 | Nearby popover | With no UMAP data, a 166 px empty box shows above the message. "UMAP minimap" is internal wording. | Click Nearby notes on a note with no UMAP run. | Empty box, then "No nearby documents available in the latest UMAP run". Fix: show the message only. | Polish | B4 | `NearbyNodesPopover.tsx` |

### B5: Cleanup at every width

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CL1 | `/cleanup` on a phone | Tapping a card changes nothing on screen. The detail and its actions sit below the whole queue. | Open `/cleanup?bucket=delete` at 390 px. Tap a card. | `scrollY` stays 0. The Archive button is at y=3926. Fix: show one detail view at a time, with Back to the queue. | Blocking | B5 | `CleanupWorkspace.tsx` |
| CL2 | `/cleanup` at tablet width | The grid starts at `md`, with no room for the detail column. The title stacks one letter per line. | Open `/cleanup?bucket=delete` at 800 px. | Grid is `190px 320px 1fr` beside the 256 px sidebar. Detail width is about 35 px. Fix: move the 3 columns to `lg` or wider. | Blocking | B5 | `CleanupWorkspace.tsx` |
| CL3 | Delete bucket | "What it holds" shows raw Markdown and repeats the title. | Open any Delete card. | Text shows `# notes decision 2692` and `[url](url)`. Fix: render the Markdown the same way as the note. | Slowing | B5 | `ArchiveOnlyPanel.tsx` |
| CL4 | Queue rows | Each row has a confidence bar and a number with no label. All visible rows have the same value. | Open Delete or Regroup. | All visible rows show 0.95 in Delete and 0.80 in Revisit link. Fix: remove the bar. Show confidence in "Why it is here" only when it differs. | Polish | B5 | `CleanupQueueList.tsx` |
| CL5 | Card header | The header shows an internal model id. | Open any card. | "heuristic-v1" beside the path. Fix: remove it, or move it to the Paid calls page. | Polish | B5 | `CleanupDetail.tsx` |
| CL6 | Action bar | The key legend does not say which key does what. | Look at the bottom of a card. | Legend reads "Enter E S J/K to move" with no link to the buttons. Fix: put each key on its button. | Polish | B5 | `CleanupActionBar.tsx` |
| CL7 | Archive action | Archive gives no confirmation and no undo at the action, and focus drops to `body`. | Click Archive on a card. | Count goes 33 to 32 in 317 ms. No toast. Focus is `BODY`, so the list reads as unchanged at a glance. Fix: corner toast with Undo. | Trust | B5 | `CleanupWorkspace.tsx`, `CleanupActionBar.tsx` |
| CL8 | Harness | The audit harness does not pass `CLEANUP_DECIDER`, so Cleanup has no data in any browser check. | Start `audit:harness`. Open `/cleanup`. | All buckets 0, and pending 6001 notes. Fix: add the key to the existing pass-through list. Do this row first, because the other B5 rows need it to verify. | Slowing | B5 | `app/scripts/audit-harness.ts` |
| CL9 | Rail | The run status block takes 6 lines in the rail. It pushes the queue to y=622 on a phone. `/cleanup` also has no `main` landmark. | Open `/cleanup` at 390 px. | First queue row at y≈700. `main` count 0. Fix: one summary line that expands in a popover, and add `main`. | Polish | B5 | `CleanupRail.tsx`, `CleanupRunStatus.tsx`, `CleanupWorkspace.tsx` |

### B6: Task editing and task history

Start this batch after PR #271 merges.

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TK1 | Task row | A click selects the whole title for edit. The next key replaces it, and blur saves. The X shortcut therefore destroys the title after a mouse click. | Click "Order filters". Press X. Click away. Reload. | Selection is 0–13 of 13. After reload the title is "x". It reproduced on two tasks. Fix: a click selects the row, and Enter or a second click edits with the caret at the end. | Blocking | B6 | `TaskRow.tsx`, `TaskTreeContext.tsx` |
| TK2 | Quick add | A failed add shows the raw text "Failed to fetch". | Go offline on `/tasks`. Add a task. | Red "Failed to fetch" in the input row. The typed text stays, which is correct. Fix: "Couldn't add. Press Enter to retry." | Polish | B6 | `TaskQuickAdd.tsx`, `createTaskActions.ts` |
| TK3 | Activity | The Tasks tab is always empty. Tasks made in the app write no activity. Only the MCP tools do. | Create and complete tasks in the UI. Open `/activity?type=task`. | "0 events" after more than 15 task writes. Fix: write activity in the shared task store or service. | Trust | B6 | `services/tasks/tasks.actions.ts`, `server/tasks/task-store.ts` |

### B7: Research map and card editing

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Map search | Enter does nothing. Results stay dimmed in place with no way to step through them. | Press `/`. Type "sale". Press Enter. | "3 found". Focus stays in the input and no card opens. Fix: Enter opens the next match and centers it. | Slowing | B7 | `map/MapToolbar.tsx`, `map/createMapFocus.ts` |
| M2 | Map state | Expansion is lost on reload. The card stays in the URL, but the path to it does not stay open. | Expand a question. Reload. | All branches are collapsed after reload. Fix: expand the path to `?card=` on load, and keep the open set in the URL or session. | Slowing | B7 | `map/createMapState.ts` |
| M3 | Map nodes | Left-side titles are cut with no ellipsis or with a mid-word stop. | Open a topic Map and look at the left branch. | "ongoing material cost am I" and "save enough to justif.." Fix: use one clamp with an ellipsis on both sides. | Polish | B7 | `map/MapNodeView.tsx`, `map/mapNodeStyles.ts` |
| M4 | Map layout | Opening a card opens the inspector, and the root moves off the left edge. | Expand a branch to a leaf. Click the leaf. | The root box is cut at x=256. Fix: pan so the picked card and its parent stay in view. | Polish | B7 | `map/createMapView.ts`, `map/TopicMap.tsx` |
| C1 | Card edit | Edit does not focus the title, and Esc does not cancel. | Open a card. Click Edit. Press Esc. | Focus is `BODY`. The form stays open after Esc, and the comment box does not return. Fix: focus the title, and Esc cancels unless the text changed. | Slowing | B7 | `detail/CardEditForm.tsx`, `detail/CardDetailPanel.tsx` |

### B8: Collections entry

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO1 | Toolbar New | The toolbar New opens the peek panel with no focus. Typed text is lost. The inline New focuses the name. The two buttons do different things. | Click the toolbar New. Type "Dune". | Focus is `BODY`. The row stays "Untitled". Inline New gives focus to `INPUT Edit name`. Fix: both buttons add a row and focus its name. | Slowing | B8 | `views/CollectionToolbar.tsx`, `CollectionViewHost.tsx` |
| CO2 | Add notes dialog | Focus lands on the Close button, not the search field. Typed text is lost. | Click Add notes. Type "budget". | Focus is `BUTTON Close dialog`. The field stays empty. Fix: pass `initialFocusEl` for the title search. | Slowing | B8 | `membership/AddNotesDialog.tsx` |
| CO3 | Add notes dialog | "Select all 200" does not say that 6,000 notes exist or that the list is capped. | Open Add notes on the scale database. | Label "Select all 200". Fix: "Select all 200 shown". | Polish | B8 | `membership/AddNotesDialog.tsx` |
| CO4 | Board and phone table | New rows land in "No status", the last column, which is cut at the right edge. At 390 px the table cuts Status with no hint. | Add a Board view. Then open the table at 390 px. | "No status" starts at x=1140 and ends at the 1408 edge. Fix: put "No status" first when it has rows, and show a right-edge fade on the phone table. | Polish | B8 | `board/CollectionBoard.tsx`, `table/CollectionTable.tsx` |

### B9: Events entry

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Add event dates | The form opens with no focus. | Note menu, Add event dates…. Type a date. | Focus is `BODY`. Fix: focus the date field. | Slowing | B9 | `events/note/AddEventDates.tsx` |
| E2 | Note with an event | The event form sits above the note and pushes the body down about 400 px. Most fields are empty. | Add a date to a note. Reopen it. | Editor toolbar moves from y≈82 to y≈489. Fix: one summary row (date, decision, place) that expands on click. | Slowing | B9 | `events/note/NoteEventSection.tsx`, `events/note/EventDetailsForm.tsx` |
| E3 | Upcoming | The count line uses the wrong plural. `/events` has no `h1`. | Add one show. Open `/events`. | "1 shows on 1 days". `h1` count 0. | Polish | B9 | `events/views/UpcomingList.tsx`, `events/views/EventsPageShell.tsx` |
| E4 | Note event | "No feeds yet. Create one under Events → Feeds." is not a link. | Add a date to a note with no feeds. | Plain text. Fix: link to `/events/feeds`. | Polish | B9 | `events/note/NoteEventSection.tsx` |

### B10: Shell, Activity and Explorer rows

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Sidebar keyboard | The keyboard path to the page passes every Recent row. There is no skip link. | Load `/` and press Tab until focus leaves the sidebar. | 53 Tab stops on `/`, `/tasks` and a topic page. Fix: add a skip link as the first stop. | Slowing | B10 | `sidebar/AppSidebarLayout.tsx` |
| S2 | Landmarks | `/research` has no `main` landmark. | Check the page structure. | `main` count 0. | Polish | B10 | `research/ResearchTopicIndex.tsx` |
| A1 | Activity on a phone | Rows with a path wrap the title to one word per line. | Open `/activity` at 390 px. | "Viewed / book / idea / 1347" on 4 lines. Fix: move the path to its own line. | Polish | B10 | `activity/ActivityEventRow.tsx` |
| A2 | Note Activity popover | One row shows the raw event name. | Open Activity on a new note. | "doc.create". Fix: "Created". | Polish | B10 | `DocActivitySummaryPopover.tsx` |
| A3 | Activity filters | The filter labels are internal names, such as "Event type: doc.update" and "Actor: magic_…". | Open More filters. | Seven raw fields. Fix: use readable labels and a preset for event type. | Polish | B10 | `activity/ActivityToolbar.tsx` |
| AR1 | Explorer drawer | The group control is cut. | Open a saved page. | "Add gr..." with room to its right. Fix: let it fit its text. | Polish | B10 | `archive/ArchiveDetailDrawer.tsx` |
| AR2 | Explorer rows | Every row repeats "Add group" as a visible control. | Open `/archive`. | 58 px rows, 13 "Add group" controls in one screen. Fix: show it on row hover or focus, and always on touch. | Polish | B10 | `archive/list/ArchiveListRow.tsx` |
| CH1 | Chat panel | The first field is a raw "Note ID…" input. There are two close controls. | Press Cmd+I. | Fields "Note ID…" and "Title (optional)", a green New Chat button, an × and a Close button. See Needs Byron before work starts. | Polish | B10 | `ai/LLMSidebar.tsx` |

### B11: First load weight

| ID | Surface | Problem | Repro | Measured evidence | Severity | Batch | Files |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | Cold load on a phone | A cold phone load is slow. | Empty cache, 4× CPU slowdown, 1.6 Mbps, 150 ms latency, uncompressed. | First paint 7.9–10.1 s. Hydrated 13.8–16.0 s on `/`, a note, `/tasks` and a topic. Desktop on loopback hydrates in 230–300 ms. Treat this as a worst case, and measure again with compression first. | Slowing | B11 | build config |
| L2 | All routes | Each route loads about 2 MB of JS in 100 or more files, including a 1,004 KB `schema` chunk. | Open any route with an empty cache. | 99–132 JS files and 2,017–2,331 KB on 11 routes. The build has 498 assets, 12.8 MB raw and 2.8 MB gzip. Fix: find out what `schema` holds, and split it from routes that do not edit notes. | Slowing | B11 | build config |
| L3 | `/archive` | The page renders every row in the first response. | Open `/archive` with 180 pages. | HTML 1,581 KB, about 8.8 KB per row. Hydrated in 722 ms, against about 270 ms for other routes. 180 of 180 rows are in the page. Fix: page the first response. | Slowing | B11 | `archive/list/ArchiveList.tsx`, `routes/archive/index.tsx` |

## Needs Byron

| Choice | Recommendation |
| --- | --- |
| Should **Delete note…** be a real delete? Cleanup archives for 30 days, but the note menu deletes for good. | Make it Archive, with the 30-day restore. It matches Cleanup. `components/DocumentViewer.tsx`, not in any batch until you choose. |
| Should **Delete all notes** stay in the Notes `…` menu? It is two clicks from 6,000 notes. | Remove it from the UI. Reset a database with a script. `features/docs-index/components/ActionsMenu.tsx`. |
| Should `/cleanup` open **Daily** or **Deep pass**? It opens Deep pass now, though the docs call Daily the maintenance view. | Open Daily, and remember the last mode in the URL. |
| What should the saved web pages be called? The sidebar says **Explorer**, the route says `/archive`, Activity says **Archive**, and **Archived notes** is a different thing. | Call them **Saved pages** everywhere, and keep "Archive" for the note action. |
| Should the **Chat** panel stay? It needs a raw note ID to start. | Keep it only if you use it. If so, start a chat from the open note and remove the ID field (CH1). If not, remove the sidebar button. |

## Worked well

These results need no work, and fixes must not regress them.

- Client navigation between main pages took 70–320 ms.
- Keyword search on 6,000 notes showed results in about 200 ms.
- Typing in a 330,000-character note took 7–10 ms per character.
- Notes list search keeps Esc and `/` behavior correct, and Back restores the list position.
- Task quick add took about 150 ms per task and keeps focus for the next task.
- The research Map, Outline and reader were readable at 1440 px, and arrow keys move between map nodes.
- The `/docs/new` draft has a working "Leave without saving?" dialog.
- `pnpm audit:shoot` found no horizontal page overflow on any of 25 routes at 1440 or 390 px.

Cmd+K pressed in the same instant as Esc failed 1 of 3 times on a note. It did not fail with a gap of 40 ms or more, so it has no row.
