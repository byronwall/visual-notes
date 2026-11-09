---
title: "Agent inbox: notes to AI, annotations, and replies"
slug: "agent-inbox"
phase: intent
status: current
last_updated: "2026-11-08"
---

# Agent inbox: notes to AI, annotations, and replies

## My read

Today the MCP connector is a pull channel. An agent does work only when you ask it in a chat. You want a channel in the other direction: you leave work for agents while you read notes and tasks, and agents pick it up later on their own schedule ("check my Visual Notes inbox every few hours").

You make requests in context. A "note to AI" on a note or a task is a small task with a thread: "research this", "follow up", "expand this". Typed text annotations add colored highlights with entries in a side rail. Some types are marked for AI, and agents act on those. Agents reply, annotate, and propose edits. You review and close.

The part that makes this work for you is one central inbox. "Needs you" sits on top: agent replies, proposed edits, questions, and new agent annotations. A collapsed feed of routine agent writes sits below it. A badge in the sidebar tells you when something is waiting. You never have to open each note to check.

This is a work queue and a conversation, not a new chat product. The in-app LLM sidebar and ChatGPT chats stay as they are.

## What matters most

- Leaving a request takes seconds, from the place where you are reading.
- A polling agent finds every open request and its context without a search.
- One place tells you what is waiting on you, apart from routine agent noise.

## The experience you want

You read a note and click "Note to AI": "find newer sources for this". Further down, you highlight a sentence with your "Question" type, which is marked for AI: "is this still true?". You also leave a private "Idea" highlight for yourself. Hours later, a scheduled agent reads the inbox. It claims both requests, so a second agent skips them. It adds the sources as a proposed new section and answers the question with an annotation on that sentence. Then it marks both requests ready for review. The sidebar badge shows 2. You open the inbox, jump to the note, accept the proposed section, and close one request. You reply to the other, and the reply reopens it.

## Boundaries

### Must be true

- A request moves through open, claimed by a named agent, ready for review, and closed. Only you close a request. A reply from you reopens it.
- An agent never changes the body of your own notes directly. It proposes edits, which show inline as suggestions that you accept or reject per block or all at once.
- On a task, the agent acts directly (subtasks, dates, a linked note), because task fields are already open to agents. Then it replies.
- Annotations have types that you manage: a name, a color, and a "for AI" flag. One type is the default, and you can change the type when you create an annotation.
- Agents can read annotations of every type as context, but act only on the types marked for AI.
- Annotations stay attached to their passage when you edit the note around them.
- Every agent action is visible and attributed in the inbox.

### Must be avoided

- Agents that annotate or edit when nobody asked. The tools allow annotations at any time, but the MCP guidance tells agents to annotate or propose edits only when asked.
- Routine agent writes that bury the items that need you.
- Annotations stored in the note body, where they would change the text, revisions, and search.
- Standing agent instructions in the app. Each agent's scheduled prompt says how it works.

## What seems settled

- First-release surfaces are notes and tasks. Research comments also appear in the inbox. Research cards and archived pages get requests later.
- The inbox shows all MCP agent activity in two tiers. Routine writes show as one line for each agent run.
- You want requests, annotations, proposals, and the inbox released together.

## Possibilities, not decisions

- One shared record for note requests, text annotations, and research comments.
- An MCP read that returns only what changed since the last poll, like `activity_query`'s `pollSince`.
- Claims that expire when an agent does not finish.

## Current reality that matters

- Research comments already follow "you leave it, the agent resolves it with a note". This is the closest existing pattern.
- Every note block has a stable id, which gives annotations and proposals an anchor.
- The MCP activity log already groups writes by tool call, which can supply the "one line per agent run" feed.

## What still needs your input

- When an agent annotates, does it always use a built-in "From AI" type, or does it pick from your types? My provisional default is a built-in "From AI" type.

## Next step after confirmation

Shape the work. You want one release, so the shape will still order the internal milestones by risk. Inline proposals are the hardest piece and should be proven early.
