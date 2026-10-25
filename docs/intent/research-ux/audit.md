# Research topics: UX, IA and MCP audit (October 24, 2026)

**Subjects:**
- [Auto Insurance Comparison — October 2026](https://notes.apps.byroni.us/research/auto-insurance-comparison-october-2026): 21 cards, 7 open, 1 draft summary.
- [Consumer 3D Printers and the Bambu A1 Buying Decision](https://notes.apps.byroni.us/research/consumer-3d-printers-and-the-bambu-a1-buying-decision): 67 cards, 5 open, 3 draft summaries.

**Evidence:**
- Byron's screenshot of the insurance canvas.
- Both topics read in full over MCP (`research_get_topic` full, `research_list_batches`, and sample `research_get_card` reads).
- Every MCP call from October 22 to 25 (`activity_query domain=mcp`).
- The earlier ChatGPT-written review [Visual Notes MCP and ChatGPT workflow review](https://notes.apps.byroni.us/docs/cmvls8mn5003gmr2mwf1ii0vb).
- The research code in this repo, and the two reference viewers (srcly deps, diagram-studio/draftably).

**Not verified live.** The browser pane stopped at the prod sign-in page, so the canvas behavior described here comes from code and the screenshot. It has not been checked in a running copy.

## Verdict

The data is mostly good and the display throws its value away. The agents wrote honest, well-dated and well-hedged cards. But the canvas has three failures, and together they make it unreadable:

1. **The layout's only structure is "came from".** Both agents built a flat fan: one root question with 19 children, or one criterion with 31 sources under it. A came-from tree lays that out as one tall column at 30% zoom. The relationships that actually matter (this option ↔ this open question, this finding ↔ these sources, this option ↔ that criterion) are `relates_to` links, and those are drawn **only for the selected card**.
2. **The groupings are drawn on top of the cards rather than made from them.**
   - Section labels ("OPTIONS 8") are text with `pointerEvents: none`.
   - Hulls are bounding boxes recomputed from per-card drag offsets.
   - Nothing contains anything, so dragging breaks every visual grouping.
3. **The reading surfaces are fixed and narrow.** Canvas cards are 248px with 3-line titles. The inspector is a fixed `22rem` with no table styling. The agent writes 300-character titles and multi-paragraph bodies with tables, which fit neither.

## Your specific complaints, with the cause of each

| Complaint | Root cause | Where |
| --- | --- | --- |
| Too much on screen, all over the place | Only *accepted* summaries fold. Both topics have only *draft* summaries, so nothing folds, and Fit lands at around 30% with every card at full detail. On top of that, `layoutForAspect` re-wraps the whole tree to the viewport's aspect, so positions change when the window or the card set changes. | `layout/fold.ts`, `tree-layout.ts:236-257`, `TopicCanvas.tsx:123-144` |
| Verbose agent content, long titles | MCP allows titles up to 300 characters and says only "One line. Full-sentence findings read best." The canvas clamps titles to 3 lines of about 32 characters, so roughly 96 characters show. There is no body-length or structure guidance, so bodies are multi-paragraph essays with inline links that duplicate the source cards. | `research.payload.ts:37-84`, `research-tools.ts:41` |
| Yellow background doesn't surround anything | The hull is `boundsOf(member rects) + padding` for the 10 cards the draft summary covers. In the screenshot, *Erie* and *Allstate lower deductibles* were dragged up and out of their column, so the hull stretched to include them, leaving a large empty cream area with the real members bunched at the bottom. Non-members (State Farm, the questions) sit just outside it, and nothing stops a non-member from being dropped inside. The hull also doesn't follow a drag in progress. | `tree-layout.ts:269-280`, `CanvasHulls.tsx` |
| Nodes can move with no tether | A drag saves `nudgeX/Y`, an offset added to the computed position *after* layout. Children don't follow, the section label stays put, edges just stretch, and there is no snap and no limit. Because the base position reflows with aspect, fold level and new cards, a nudged card drifts. "Reset position" in the detail panel is the only way back. | `TopicCanvas.tsx:264-277`, `tree-layout.ts:227-230` |
| Sidebar can't be resized | `gridTemplateColumns: minmax(0,1fr) 22rem` (26rem at 2xl). It can be toggled, but not resized or expanded. | `ResearchTopicPage.tsx:203` |
| Tables are unreadable in the sidebar | `CardBody` renders GFM tables (marked + sanitize), but its CSS styles only `p`, `ul` and `a`: no borders, padding or horizontal scroll, under `maxW: prose`. | `CardBody.tsx:23,52-59` |
| Are "options / findings / criteria" hard-coded? | **Yes.** They come from the Prisma enum `ResearchCardType`: task, question, finding, source, option, criterion (plus summary). Plurals and display order are fixed in `sections.ts`. They are *not* per-analysis. | `schema.prisma:851-859`, `sections.ts:7-25` |
| Group labels have no interactivity; nodes leave them | Labels appear only when a parent has more than 6 children (`SECTION_MIN`). They are passive text: no collapse, filter, select or drop target. A section isn't a container, so it can't hold its cards. | `sections.ts:28`, `CanvasLanes.tsx:20` |

## What the two topics actually look like (IA)

### Insurance (21 cards)
- **Shape:** 1 root question → 19 flat siblings (1 criterion, 9 options, 1 finding, 1 source, 6 questions), plus 2 root-level sources.
- **The real structure is in 15 relates_to links:**
  - each option ↔ its blocking question (GEICO ↔ "final verified price", Travelers ↔ "collision document", …);
  - 5 options ↔ the criterion.
  
  The canvas never shows these unless you click a card.
- **This is a decision, and its natural shape is a table:** options as rows; price, term, coverage gaps, blocker and status as columns; the criterion as the column set. The agent knew this and *also* built an 11-row collection with table and board views. The research topic is the weakest of the three representations of the same data.
- **Three copies that drift:**
  - a 35k-character note;
  - an 11-row collection;
  - the research topic.
  
  The earlier review caught two problems here: four provider bodies were copy-pasted (corrected on Oct 24 in batch `insurance-oct24-provider-body-correction-v1`), and the "preserve Progressive coverage" criterion is outdated after the later policy analysis. **The criterion is still outdated.**
- **Two source cards point at the same note** (`f12d711a…` and `54e97774…` → `cmvkwduo2000ip52nlcu6xq6d`).

### 3D printers (67 cards)
- **Shape:** 5 root questions plus 2 root criteria. The first criterion, "Keep October 24 evidence separate…", is used as a **parking parent for all 31 sources**: it is a process rule, not a decision criterion. That one card has 31 children, which is why the canvas has a huge tail.
- **52 relates_to links** tie findings to sources. They are invisible, so the sources look orphaned.
- **Findings are essays.** For example, "Choose the Combo for controlled color…" runs about 2.5k characters, with five inline source links repeated as cards and a first-person "Why I still lean A1 Combo for you" argument. It is good content but a poor card. It reads like a section of the buying guide it came from, and **that guide doesn't appear to be saved as a note**, so the topic is the only home for a long document that was chopped into 67 pieces.
- **Options carry the real comparison data** in a regular format: "Price status… Best fit… Main tradeoff…". That is structured data stored as prose. Again, a table is the right view.
- **Three draft summaries cover 11, 9 and 4 cards.** None is accepted, so none folds, and each draws a hull.

### What this says about the IA
The type set (question / finding / option / criterion / source / task) is reasonable, but the app gives the types no behavior beyond an icon and a section label:
- An **option** has no fields (price, status, verdict) and no option × criterion grid. The decision view was planned and never built (`docs/intent/research-threads`).
- A **source** is a full card. It should be a citation hanging off the findings that use it.
- A **criterion** is a card, when it should be the column header of the decision.
- **Question → answer** isn't modeled. A finding that answers a question is just a child, and nothing says "answered".
- **Summary** is a separate group concept with draft/accept. It is the only way to reduce density, and it needs an accept click that nobody has made.

The result is that the agent has to express a decision matrix, an evidence graph and a long-form guide in one primitive (card + came-from + hidden links), and the canvas can only draw the came-from part.

## MCP activity: what went well and badly

**Good**
- **Zero errors** across about 300 calls in the window. Research writes took 15–70 ms, and note writes under 1 s.
- **Batch discipline:**
  - Every research write has a meaningful `batchKey` and summary (`insurance-oct23-evidence-v1`, `a1-guide-20261024-sources`).
  - The 3D topic went in as 8 themed batches in about 60 seconds, each undoable.
- **Honest status language:** "awaiting price", "user-deferred", "route not completed", "displayed, collision contradiction". Summaries are explicitly marked as drafts "without deciding or purchasing".
- **Self-correction:** the copied provider bodies were found and fixed with `research_update_cards` plus `notes_edit_blocks` in one pass, on Oct 24 at 02:50.
- **Questions are used well** as the open frontier: 7 and 5 open questions, each phrased as a decision.

**Bad**
- **Read-back storm:** after writing the 3D topic, the agent made **about 70 parallel `research_get_card` calls**, one per card, to verify. The write result plus `get_topic full` should have been enough. Either the write response doesn't return enough to verify, or the outline truncates bodies at 160 characters and makes the agent re-read everything.
- **Fan-out with no guidance:** nothing in the tool descriptions says "keep 3–7 children per parent", "group sources under the finding they support", or "don't use a criterion as a folder". So the agent produced a 19-way fan and a 31-way fan.
- **Content stored as prose:** option data (price, term, tradeoff) went into markdown bodies because cards have no fields. The insurance agent worked around this by building a separate collection.
- **Long-form source not kept:** the 3D buying guide was split into cards with no source note. The insurance note *was* kept, but now drifts from the topic.
- **Links are write-only in practice:** the agent invested 67 links that the UI hides.
- **No per-card `appUrl`** in topic and batch output, so the agent can't hand Byron a link to "the GEICO card".
- **Many earlier findings are now fixed** by PRs #207–#211: search index, image validation, activity paging, collection row batching, save guidance. Still open from that review: the outdated insurance criterion, and the three-copies drift.

## How srcly and draftably handle the same problems

| Problem here | srcly deps (`srcly/client/src/viz/deps/`) | diagram-studio / draftably |
| --- | --- | --- |
| Positions drift; free drag breaks structure | **No node dragging.** Layout owns positions. Click focuses or recenters, and history is breadcrumbs plus back/forward. | Drag snaps to the centers of other cards (Ctrl bypasses). Dropping into a container **reparents** the card. Esc cancels a drag back to its snapshot. Layout can be scoped to a selection, neighborhood or container, with pinned `fixedIds`. |
| Groups don't contain anything | `GroupFrame` is sized from its boxes (`FRAME_PAD`), and boxes are packed into it. | True compound containers: `parentId` plus `fitContainer` auto-sizes to the children. Collapse shrinks to a header, and edges reroute to the proxy. |
| Too many cards | `DEFAULT_BUDGET = 48` boxes. Over budget, it rolls up by folder, focus sits in the center, importers go left and imports right. | Collapsed containers. |
| Hidden relationships | Hover dims unrelated edges to 0.12 and nodes to 0.62. Edges are bundled in orthogonal channels, and hub edges show on hover. | Orthogonal routing around obstacles, with ports. |
| Text doesn't fit | Uniform 176×74 boxes. `wrapName` caps the line count, and full text is in the hover card. Zoom detail levels keep on-screen text size constant (`boxText.ts`). | Measured text wrap (`labels.ts`). |
| Fixed sidebar | Resizable: 1px handle, double-click to reset, drag far left to hide (`App.tsx:565`). | Fixed 280px (no better). |
| Keyboard | Arrow keys move spatially; `/` go-to palette; `?` shortcuts sheet; 0 to fit. | N / Tab / L / ?. |
| Layout quality | Geometry tests count node and edge crossings (`geometry.ts`). | Several algorithms behind a worker; preview before commit. |

## Candidate directions (for discussion, not decided)

- **A. Make groups real.** Sections become containers sized to their cards, with drag constrained inside them (or no drag at all, srcly-style). Collapse a section to a count chip, and drop onto a section to retype a card. Hulls go away, or wrap only true containers.
- **B. Typed views over the same cards.** Options × criteria as a **decision table** (the planned and unbuilt decision view). Questions → answers as a **frontier list**. Sources become **citations** on findings rather than nodes. The canvas becomes one view among several, not the only one.
- **C. Focus-plus-context canvas.** srcly-style: focus a card, put its came-from chain on the left and its children and related cards on the right, under a box budget with roll-ups. Relates-to links are shown for the focus. Positions belong to the layout.
- **D. Reading surface.** A resizable or expandable inspector, with a "read" mode that opens a card as a full-width document. Real table styling. Titles cut short on canvas with the full text on hover.
- **E. Agent contract.** A short-title field (≤60 characters) plus a body; fan-out guidance; sources attached to findings; option fields (price / status / verdict); a source-note link for long-form origins; per-card `appUrl`; write results that make read-back unnecessary.
- **F. Density defaults.** Draft summaries fold for display by default, or Fit opens on open questions plus summaries; uniform card size; zoom detail levels.
