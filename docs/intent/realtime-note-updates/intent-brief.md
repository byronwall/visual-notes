---
title: "Realtime note updates"
slug: "realtime-note-updates"
phase: intent
status: current
last_updated: "2026-10-19"
---

# Realtime note updates

## My read

You created a note from ChatGPT through the MCP connector, and it worked. But the Visual Notes tab you had open didn't show the note until you refreshed. Now that notes get written from places other than the open tab, that tab has to stay current on its own. The outcome you want is simple: a note written anywhere shows up in the app you're looking at within a second or two, with no refresh.

WebSockets are one way to get there, not a requirement. You expect the work to be straightforward, so the appetite is small.

## What matters most

- New and changed notes appear in open tabs without a manual refresh.
- Updates never overwrite typing you haven't saved.
- Every write path counts, not only MCP.

## The experience or behavior you appear to want

ChatGPT creates or appends to a note. The notes index, path views, and recent-notes list in the open tab update by themselves. If that note is already open and you haven't edited it, its content refreshes in place. If you have unsaved edits, a small notice says the note changed elsewhere and lets you reload it when you choose.

## Boundaries

### Must be true

- Updates fire for every note write: MCP, other tabs and devices, CLI ingest, the extension, and bulk actions.
- The views that matter most are the notes index and its search, path and tree views, and recently changed lists.
- An open note refreshes automatically only when it has no unsaved changes.

### Must be avoided

- Losing or replacing local edits.
- A tab reloading its own save and moving the cursor.
- Leaking note activity to unauthenticated connections.

## What seems settled

- Behavior for an open note: refresh it automatically when it's clean. For unsaved edits, the notice was superseded on 2026-10-20 by block storage's per-block merge: both edits are kept, and a same-block conflict goes to Versions with a toast.
- Scope: every note write, not just ChatGPT.

## Possibilities, not decisions

- The transport itself (WebSocket, server-sent events, or polling when the tab regains focus).
- Whether the canvas and UMAP views update live.

## Current reality that matters

- The app already turns on SolidStart's experimental WebSocket support. It has a `/ws/jobs` endpoint, an in-process broadcast bus, and a reconnecting browser client. No browser code connects to that client yet, so WebSockets have never been proven in production.
- List views read data through `createAsync` and router queries, so `revalidate` refreshes them. The note page and the editor use `createResource`, so they need an explicit refetch.
- Production runs as one app container, so an in-process bus is enough.

## Next step after confirmation

Shape the change. See [shape-brief.md](shape-brief.md).
