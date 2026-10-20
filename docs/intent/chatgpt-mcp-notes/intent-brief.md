---
title: "ChatGPT read/write access to Visual Notes via MCP"
slug: "chatgpt-mcp-notes"
phase: intent
status: current
last_updated: "2026-10-18"
---

# ChatGPT read/write access to Visual Notes via MCP

## My read

Right now ChatGPT's useful output (research write-ups, plans, quick facts, chat digests) ends up stuck in ChatGPT's own artifacts. You want Visual Notes to be the long-term home for that material instead. ChatGPT should be able to save into the production note site and find that material again in a later chat.

The goal is a single knowledge base, not a ChatGPT feature. ChatGPT becomes one more author and reader of the notes, next to you in the app. It files notes into your path tree the way you would. Later it can pull them back as working context, whether the request is fuzzy ("what did we decide about X?"), exact ("the note called Y"), or time-based ("what did I save this week?").

The mechanism is a suite of MCP tools exposed by the prod site and registered as a ChatGPT custom connector. Because ChatGPT will get write access to prod, the connection must use real OAuth tied to your existing login. A shared secret is not enough.

## What matters most

- ChatGPT can save any kind of output into the notes and file it sensibly.
- ChatGPT can find and load notes again later through fuzzy, exact, recent, and browse lookups.
- Write access to prod is properly authenticated and cannot touch your own writing.

## The experience or behavior you appear to want

In a ChatGPT chat you say "save this to my notes." ChatGPT looks at your existing paths, picks or creates a fitting one, and saves a markdown note. It replies with the note's title, path, and a link. Days later, in a different chat, you ask "pull up what we worked out on the canvas redesign." ChatGPT searches, loads the relevant notes, and can revise the plan it wrote earlier. It cannot revise a note you wrote in the app.

## Boundaries

### Must be true

- Authentication is OAuth, approved once through your normal Visual Notes login.
- Every ChatGPT edit keeps the previous version so you can roll it back.
- v1 covers notes only; tasks, time blocks, and the web archive are out of scope.
- ChatGPT can read every note.
- ChatGPT can create notes anywhere, including new paths.
- ChatGPT can edit only notes it created. Your later edits to such a note do not take that permission away.
- Saved notes become ordinary notes: visible in the app, editable by you, and included in search and embeddings.

### Must be avoided

- ChatGPT editing or deleting notes that you wrote.
- An unauthenticated or guessable endpoint that can write to prod.
- A parallel "ChatGPT storage" area that sits apart from the real notes.

## What seems settled

- Content scope: long reports, plans/specs, snippets, and conversation summaries.
- Write scope: create notes, and edit the notes it created.
- Placement: ChatGPT chooses the path and may invent new ones.
- Read scope: everything; no paths are hidden from it.
- Retrieval: semantic recall, exact lookup, recent/browse, and bulk loading into context.

## Possibilities, not decisions

- Marking ChatGPT's notes with `originalSource = "chatgpt"` (or a meta field) and using that to enforce "its own."
- Edit as full replacement versus section-level patch or append.
- Deletion. This brief assumes there is no delete tool.

## Current reality that matters

- `Doc` has no owner column; the app is effectively single-user. "Its own" therefore has to come from provenance, not from user ownership.
- Notes already have dot-path organization, a content hash, an `(originalSource, originalContentId)` identity, and doc- and section-level embeddings. Semantic search can reuse the existing pipeline.
- Login today is a single magic password that sets a signed cookie, and there is no OAuth authorization server. An OAuth server therefore has to be built, and it can stay single-user.
- The archive ingest already uses a bearer-token pattern (`ARCHIVE_INGEST_TOKEN`). It is a useful local stand-in while the OAuth work is in progress.

## Next step after confirmation

Shaped in [shape-brief.md](shape-brief.md). Next is the plan, starting with a locally runnable MCP server that works against dev data. The OAuth and prod connector work comes after that.
