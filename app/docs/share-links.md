# Share Links

This document describes the note sharing feature for Visual Notes.

## Overview

Visual Notes supports creating a public share link for a note. A shared note:

- gets a public URL under `/share/[slug]`
- renders as a read-only story view without editor chrome
- exposes Open Graph and Twitter metadata for previews
- can be updated to use a custom slug
- can be cancelled by deleting the share record

Only one active share is supported per note.

## Data Model

The feature uses a `DocShare` table related one-to-one with `Doc`.

Stored fields:

- `docId`
- `slug`
- `shareUrl`
- timestamps

Behavior:

- creating a share inserts a `DocShare` row
- updating a share changes the slug and derived share URL
- cancelling a share deletes the row entirely

## Private UI

On the note page, sharing is exposed through a compact popover trigger in the
top action row.

States:

- `Share` when the note is not public
- `Shared` with a distinct green treatment when a public link exists

The popover allows:

- setting or changing the slug
- opening the public story
- copying the full share URL
- cancelling the share

The notes list also surfaces shared state with a small shared badge.

## Public Route

Shared notes render at:

- `/share/[slug]`

This route is intentionally public and bypasses auth. The page renders the note
content using the shared read-only content styling instead of the TipTap editor
surface.

Characteristics:

- no editing controls
- no save/delete UI
- note title and optional path visible
- note body rendered from sanitized stored HTML

## OG Preview Route

The feature includes a dynamic OG image route:

- `/share-og/[slug]`

This route generates an SVG preview card using the shared note title, preview
text, and share URL.

The share page sets:

- `og:title`
- `og:description`
- `og:url`
- `og:image`
- matching Twitter tags

## Auth Handling

Both layers must allow public share access:

- server middleware allows `/share/*` and `/share-og/*`
- client auth gate must not redirect `/share/*` to `/login`

If only the server is bypassed, the page can SSR correctly and then redirect
after hydration. The client gate must match the server exemption.

## Relevant Files

- [schema.prisma](/Users/byronwall/Projects/visual-notes/app/prisma/schema.prisma)
- [doc-shares.actions.ts](/Users/byronwall/Projects/visual-notes/app/src/services/doc-shares.actions.ts)
- [doc-shares.queries.ts](/Users/byronwall/Projects/visual-notes/app/src/services/doc-shares.queries.ts)
- [DocSharePanel.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/DocSharePanel.tsx)
- [DocumentViewer.tsx](/Users/byronwall/Projects/visual-notes/app/src/components/DocumentViewer.tsx)
- [share/[slug].tsx](/Users/byronwall/Projects/visual-notes/app/src/routes/share/[slug].tsx)
- [share-og/[slug].ts](/Users/byronwall/Projects/visual-notes/app/src/routes/share-og/[slug].ts)
- [app.tsx](/Users/byronwall/Projects/visual-notes/app/src/app.tsx)
- [middleware.ts](/Users/byronwall/Projects/visual-notes/app/src/middleware.ts)

