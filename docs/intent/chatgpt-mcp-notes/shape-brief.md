---
title: "ChatGPT read/write access to Visual Notes via MCP — shape brief"
slug: "chatgpt-mcp-notes"
phase: shape
status: current
last_updated: "2026-10-18"
---

# ChatGPT notes connector — what we are adding

**Outcome:** ChatGPT can save its output into Visual Notes, file it in your path tree, find it again in later chats, and revise what it wrote. Your own notes stay safe from edits.

**Primary flow:** Add the connector in ChatGPT → sign in once with the Visual Notes password and approve → "save this" → note appears in the app with a link → in a later chat, "find what we decided about X" → ChatGPT searches, reads, and optionally updates its note.

## Feature scope

```text
Visual Notes MCP connector (served by the prod app at /mcp)
├── PLANNED ADDITIONS
│   ├── Connect + authorize
│   │   ├── OAuth 2.1 + PKCE, single user, behind the existing magic-password login
│   │   ├── One-screen consent page; connection listed in the app and revocable
│   │   └── Short-lived access tokens; refresh tokens stored so they can be revoked
│   ├── Find tools (read-only)
│   │   ├── search(query, path?, limit) — title/body/path keyword match, ranked
│   │   │   └── plus meaning-based matches once embeddings cover new notes
│   │   ├── list_recent(since?, path?, createdBy?) — "what did I save this week"
│   │   ├── list_paths(prefix?) — path tree with counts, used before filing
│   │   └── get_notes(ids[]) — full markdown for one or several notes at once
│   ├── Write tools
│   │   ├── create_note(title, path, markdown) — any path, new paths allowed
│   │   ├── update_note(id, title?, path?, markdown?) — ChatGPT-created notes only
│   │   └── append_to_note(id, markdown) — same ownership rule; cheap way to add to a running log
│   ├── Provenance + safety
│   │   ├── ChatGPT notes marked by origin; your later edits don't change it
│   │   ├── Every ChatGPT edit snapshots the prior title/path/markdown first
│   │   └── Every tool call logged as an activity event with actor "chatgpt"
│   └── In the app
│       ├── "Saved by ChatGPT" marker on the note
│       └── Version list on the note with one-click restore
├── EVALUATE BEFORE COMMITTING
│   └── Meaning-based search quality on your real corpus vs keyword alone
└── LATER POSSIBILITIES
    └── Tasks, time blocks, web archive; delete; edits to notes you wrote
```

## Behavior

| Situation | Expected result |
| --- | --- |
| `update_note` on a note you wrote | Refused with a clear error; ChatGPT is told to create a linked follow-up note instead |
| Note you wrote is stored only as rich text | `get_notes` returns it converted to markdown |
| `create_note` with a path that doesn't exist | Path is created; the tool result names it as new |
| ChatGPT retries a save after a timeout | No duplicate: a client-supplied idempotency key returns the first note |
| Token missing/expired/revoked | 401 with the auth challenge, so ChatGPT shows "reconnect" |
| You revoke the connection in the app | Next call fails; existing notes stay untouched |

## Examples

Tool result for `create_note` *(shape illustrative)*:

```json
{ "id": "ck…", "title": "Canvas redesign plan", "path": "work.visual-notes.canvas",
  "pathIsNew": true, "url": "https://<prod>/docs/ck…", "version": 1 }
```

## Decisions and boundaries

**Appetite:** One focused capability. It adds a single MCP endpoint, a minimal OAuth server for one user, one new table for note versions, and two small UI touches. It does not add a general API platform or multi-user support.

**Key decision: build the OAuth server by hand and keep it minimal.** ChatGPT needs protected-resource metadata, authorization-server metadata with S256 PKCE, client registration (dynamic registration is enough), and audience-checked tokens. Your login is already a single magic password. That makes a small purpose-built server smaller and easier to test than adopting a general identity provider. Each piece can be proven locally with the MCP Inspector before ChatGPT is involved.

**Key decision: ship keyword search first, with meaning-based search behind the same tool.** Embeddings exist today, but they come from batch runs. A note saved a minute ago would not be found by meaning until the next run. Keyword search plus path browsing covers exact lookup and recent items right away, and ChatGPT is good at rephrasing a query several times. Meaning-based recall is added to `search` once new notes are embedded on save. ChatGPT sees no change in the tools when that happens.

**Boundary:**
- Notes only, and there is no delete tool.
- Version snapshots are taken only for ChatGPT edits. Your own edits keep working as they do today.
- The connector can be switched off with an env flag. That flag disables `/mcp` and the OAuth routes, and the rest of the app is unaffected.

**First proof:** **Try:** run `search`, `get_notes`, `create_note`, and `update_note` against a local dev database from the MCP Inspector, first with a dev-only bearer token and then through the local OAuth flow. **Observe:** a note created from the Inspector shows up in the app under the new path. An update snapshots a version. An update to a note you wrote is refused. **Decide:** if all three hold, move to the deployed ChatGPT connector smoke. If the SolidStart route can't host the MCP transport cleanly, fall back to a small sidecar handler and decide that before writing more tools.

**Open choices:** none blocking. One choice is reversible: restore the version list in the app now, or leave restore as an admin-only action for v1.

Intent: [intent-brief.md](intent-brief.md)
