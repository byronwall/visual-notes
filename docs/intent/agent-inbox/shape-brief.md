---
title: "Agent inbox — shape brief"
slug: "agent-inbox"
phase: shape
status: draft
last_updated: "2026-11-08"
---

# Agent inbox — what we are adding

**Outcome:** You leave work for agents where you read. Polling agents find it, act, and answer. One inbox shows what waits on you.

**Primary flow:** Note to AI or typed highlight → an agent polls, claims, and acts → reply, annotation, or proposed edit → "Needs you" badge → review in the note → close or reply.

## Feature scope

```text
Agent inbox
├── PLANNED ADDITIONS
│   ├── Annotations on notes (one record for both kinds)
│   │   ├── Note to AI: a header button; whole-note request with no passage
│   │   ├── Highlight: select text → pick a type → comment
│   │   │   └── colored highlight drawn over the text, never stored in the note body
│   │   └── Annotation rail opposite the TOC: entries in note order, thread, status
│   ├── Annotation types (settings page)
│   │   ├── name, color, "for AI" flag; one default
│   │   └── built-in: "Request" (for AI, default for Note to AI), "From AI" (agent-written)
│   ├── Request lifecycle on for-AI annotations
│   │   ├── open → claimed by <agent> → ready for review → closed
│   │   └── reply thread; your reply reopens it
│   ├── Proposed edits on your notes
│   │   ├── shown inline: struck-through old blocks, tinted new blocks
│   │   └── accept or reject each block or all, in the note
│   ├── Note to AI on tasks: button on the task row/detail; thread under the task
│   ├── Inbox page (/inbox) + sidebar badge
│   │   ├── Needs you: ready requests, agent replies, agent annotations, proposals,
│   │   │   research comments an agent resolved; each item links to its passage
│   │   ├── Waiting on agents: open and claimed requests
│   │   └── Agent activity: one collapsed line per agent run (from the MCP call log)
│   └── MCP tools
│       ├── inbox_get: open requests with note, passage, thread, and annotations nearby;
│       │   also open research comments; a since-cursor for polls
│       ├── inbox_claim, inbox_reply (optional: mark ready)
│       ├── notes_annotate: highlight a passage or the whole note, "From AI" type
│       └── notes_propose_edits: same ops as notes_edit_blocks, held for your review
└── LATER POSSIBILITIES
    └── requests on research cards and archived pages; push or digest signals
```

## Behavior

| Situation | Expected result |
| --- | --- |
| You edit text elsewhere in the note | Highlights stay on their passage. |
| You rewrite the highlighted passage | The highlight follows the edit. If you delete the whole passage, the annotation stays in the rail as "passage removed". |
| Two agents poll at once | The first claim wins. The second agent gets "claimed by ChatGPT" and skips. |
| A claim gets no reply in 24 h (proposed default) | The request returns to open. |
| A block changes after an agent proposed an edit to it | That block's suggestion shows "note changed". You cannot accept it. The agent can propose again. |
| You accept a suggestion | The editor applies it as your own edit, and autosave writes it with a revision. The thread records "accepted". |
| An agent annotates without a request | The tool allows it. Its description says to annotate or propose edits only when asked. |

## Example: what a poll returns (proposal, not settled)

```text
inbox_get → 2 open
1. [Request] "find newer sources" · note "Heat pump sizing" (whole note) · you, 3 h ago
2. [Question] "is this still true?" · note "Heat pump sizing" ^b7k2
   passage: "Cold-climate units lose 40% capacity at -15°F"
   thread: —   nearby: [Idea] "compare with Mitsubishi" (yours)
pollSince: 2026-11-08T14:02:11Z
```

## Decisions and boundaries

**Appetite:** One release with all four pieces, as you asked. Inside the release, the risky parts come first.

**Key decision:** When you accept a suggestion, the change applies in the open editor as your own edit. It does not go through a server-side write. The editor and autosave already keep live and deferred content consistent. A second writer path would race with unsaved typing, and recent bug fixes went into exactly that seam.

**Key decision:** Highlights are a layer drawn over the text and anchored by block id plus the quoted text. They are not marks in the note content, so the text, revisions, search, and markdown export stay clean.

**Key decision:** Research comments keep their own table. The inbox reads them, and `inbox_get` lists them. Merging the two tables would cost a migration and would add nothing for you.

**Boundary:** Agents still never write your note bodies. One env switch hides the MCP inbox tools, the rail, and the inbox page. Annotation data stays when the flag is off. No push, email, or standing agent instructions.

**First proof:** **Try:** Use the existing MCP smoke script as a fake agent on a local seeded note. It claims a request, annotates a passage, and proposes a replace and an insert. Then you open the note, type in another block, and accept one suggestion. **Observe:** The highlight stays on its passage, and the suggestions render inline. The accepted block lands through autosave with no lost keystrokes, and the inbox moves the request to "Needs you". **Decide:** If inline accept works in the open editor, build the rest on that approach. If it fights the editor, use the fallback: review a diff in the inbox and accept it all at once on the server, with the editor reloading. Confirm afterward that a real scheduled ChatGPT task can call the inbox tools without you there.

**Open choices:** Do agent annotations always use "From AI", or can agents pick from your types? (The provisional default is "From AI".)

See [intent-brief.md](intent-brief.md).
