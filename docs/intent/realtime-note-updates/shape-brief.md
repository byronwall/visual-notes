---
title: "Realtime note updates — shape brief"
slug: "realtime-note-updates"
phase: shape
status: current
last_updated: "2026-10-19"
---

# Realtime note updates — what we are adding

**Outcome:** A note written anywhere appears in every open, signed-in tab within about a second, and nobody loses unsaved edits.

**Primary flow:** ChatGPT (or another tab, the CLI, or the extension) writes a note → the server publishes "notes changed" → each tab refreshes its note lists and, when it's safe, the open note.

## Feature scope

```text
Live note updates
├── PLANNED ADDITIONS
│   ├── One publish point for every note write
│   │   └── Prisma hook on Doc create/update/delete, with note ids when Prisma returns them
│   ├── Authenticated notes socket (/ws/notes)
│   │   └── Rejects connections without a valid magic-session cookie
│   ├── Lists refresh themselves
│   │   └── Notes index and search, path/tree views, sidebar recent notes
│   ├── Open note stays current
│   │   ├── Clean → refetches in place
│   │   ├── Dirty → "Changed elsewhere · Reload" notice
│   │   └── The tab's own save → ignored (no echo)
│   └── Catch-up after a gap
│       └── Reconnect or tab refocus → one refresh
└── LATER POSSIBILITIES
    ├── Canvas / UMAP live updates
    └── "Updated by ChatGPT" toast or presence
```

## Behavior

| Situation | Expected result |
| --- | --- |
| ChatGPT creates a note | Index, path view, and recent list show it; no reload |
| ChatGPT appends to the open note, no local edits | Editor content refreshes |
| Same, with unsaved local edits | Content stays; notice offers Reload |
| This tab saves the note | No refetch and no cursor jump |
| Bulk delete or move of 50 notes | One debounced list refresh, not 50 |
| Laptop sleeps, then wakes | Socket reconnects, then one catch-up refresh |
| Signed-out request to /ws/notes | Connection closed and no events sent |

## Decisions and boundaries

**Appetite:** Small, a few focused PRs. It reuses the existing WebSocket plumbing and adds no new dependency or migration.

**Key decision:** Events are a **signal, not data**. Each one says which notes changed (`{type:"notes:changed", ids, at}`), and the client re-runs the queries it already has. That avoids building a client-side cache that merges note content, and every view stays correct because it reads through its normal query.

The publish point sits in one Prisma hook instead of in ten write sites. That way new write paths can't forget to publish. If the extension's typing fights us, the fallback is an explicit `publishNoteChange()` in the write services.

The jobs socket is a working pattern to copy, not an endpoint to reuse. It has no browser consumer and no auth.

**Boundary:** This assumes a single server process. Running several app instances would need Postgres `LISTEN/NOTIFY` behind the same publish function. The canvas and UMAP views stay manual for now.

To turn it off, set the runtime server flag `NOTE_LIVE_SYNC=false`. Tabs then behave exactly as they do today.

**First proof:** **Try:** in local dev, create a note through the MCP Inspector while the notes index is open in a browser. **Observe:** the note appears without a reload, and a second tab's save doesn't jump the cursor in the first. **Decide:** if both hold, move on to the open-note dirty/clean handling and the deployed check. If the WebSocket router won't upgrade or authenticate under vinxi, switch the transport to server-sent events behind the same client hook.

**Open choices:** none blocking. Production WebSocket proxy support is checked in milestone 3.

Intent: [intent-brief.md](intent-brief.md) · Plan: [implementation-plan.md](implementation-plan.md)
