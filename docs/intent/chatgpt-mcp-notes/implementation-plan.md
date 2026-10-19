---
title: "ChatGPT read/write access to Visual Notes via MCP — implementation plan"
slug: "chatgpt-mcp-notes"
phase: plan
status: draft
last_updated: "2026-10-18"
---

# ChatGPT notes connector — implementation plan

## Plan at a glance

The plan keeps three hard problems apart: what the tools do, how ChatGPT authenticates, and whether ChatGPT accepts the deployed result. Each one gets its own loop, and the first two run entirely on a local machine.

1. **Tools first, behind a dev token.** Build the full tool suite against a synthetic local database and drive it from the MCP Inspector. Ownership rules, version snapshots, idempotent creates, and the html→markdown conversion are all proven before any auth code exists.
2. **OAuth second, still local.** Add the single-user OAuth server and prove it with the Inspector's own OAuth flow. Token bugs then show up in seconds, not after a deploy.
3. **ChatGPT third, on prod.** Deploy behind a kill-switch flag and run one save → find → revise loop from a real chat. This is the first point where prod and ChatGPT are involved.
4. **App surfaces and semantic recall last.** Each one is independently useful and neither blocks the connector.

**Material pushback:** don't start with OAuth, and don't test against ChatGPT until the end. ChatGPT reports most failures as a generic "connector error," so it is the slowest and least informative test client available.

## Implementation strategy

- **First proof:** from the Inspector, create a note at a new path, see it in the app, update it, see a version snapshot, and get refused when updating a note you wrote.
- **Primary seam:** a plain `notes-connector` service (`app/src/server/mcp/`) that owns the tool behavior and calls the existing Prisma/doc logic (`applyDocUpdate`, the ingest normalization). The MCP route and the auth check are thin adapters around it.
- **Fast local loop:** `pnpm test src/server/mcp` for service rules; `pnpm audit:harness` on an assigned port with a `visual_notes_audit_*` database; `pnpm dlx @modelcontextprotocol/inspector` pointed at `http://127.0.0.1:<port>/mcp`.
- **Local dependencies:** synthetic audit database with a few seeded notes (some markdown, some html-only, one ChatGPT-origin). No network. `OPENAI_API_KEY` stays empty until M5.
- **Provider/live confirmation:** one deployed ChatGPT developer-mode connector smoke in M3.
- **Rollout and rollback:** `MCP_CONNECTOR_ENABLED` env flag makes `/mcp`, `/oauth/*`, and `/.well-known/oauth-*` return 404. Rotating `MCP_TOKEN_SECRET` invalidates every issued token. Neither touches the rest of the app.

### Material dependency proof strategy

```text
notes-connector service + vitest (no MCP, no auth)
    → MCP route + dev bearer, driven by Inspector on the audit DB
    → local OAuth flow, driven by Inspector's auth mode
    → ChatGPT developer-mode connector against deployed prod (one smoke)
```

There is no fake ChatGPT. The Inspector is the faithful local MCP client, and only ChatGPT-specific OAuth behavior (redirect URI, `iss` handling, linking UI) is left to the live smoke.

## Milestone 1: ChatGPT-shaped tools work locally from the Inspector

This is the fastest proof of the product behavior. It deliberately leaves out OAuth and ChatGPT.

- **Spike — host the MCP transport in a SolidStart API route**
  - Decision required: run the official SDK's web-standard Streamable HTTP transport (stateless, JSON responses) inside `src/routes/mcp.ts`, or hand-write `initialize` / `tools/list` / `tools/call` JSON-RPC.
  - Evidence to gather: Inspector lists tools and calls one through a vinxi dev route. Check the SDK version and its zod compatibility with the repo's zod 3.
  - Fallback: a hand-written JSON-RPC handler that keeps the same tool definitions. If routing itself fights back, use a small sidecar process.
- **Change — schema: provenance and versions**
  - `DocRevision` table (docId, title, path, markdown, html, createdAt, actor). Add a `chatgpt` value to `ActionActorType`. Generate the migration with `prisma migrate dev`.
  - ChatGPT notes use `originalSource = "chatgpt"` and `originalContentId = <idempotency key or cuid>`. The existing unique index gives idempotent creates for free.
- **Change — notes-connector service**
  - `search`: Postgres keyword match on title, path, and body. Titles and paths rank above body hits. Results return id, title, path, snippet, updatedAt, and createdBy.
  - `list_recent`, `list_paths` (prefix plus counts; reuses `fetchPathStats` logic), and `get_notes` (up to N ids; html-only notes converted to markdown with `turndown`).
  - `create_note`: accepts any path, reports `pathIsNew`, and builds the url with the app's `/docs/<id>`.
  - `update_note` and `append_to_note` refuse unless `originalSource === "chatgpt"`. They write a `DocRevision` and then call `applyDocUpdate` in one transaction.
  - Each call logs an `ActionEvent` with actor `chatgpt`.
  - Verification: vitest covers ownership refusal, the snapshot-before-write order, idempotent create, the new-path flag, html→markdown, and the search ranking order.
- **Change — MCP route, flag, middleware**
  - Tool descriptions are written for ChatGPT: call `list_paths` before filing, and create a follow-up note when an update is refused.
  - `MCP_CONNECTOR_ENABLED` gate. A temporary `MCP_DEV_TOKEN` bearer check is accepted only when `NODE_ENV !== "production"`. `/mcp` is added to the middleware allowlist with its own auth check.

### Desired end state

- From the Inspector against the audit database, all seven tools work. A created note renders at `/docs/<id>` under a new path.
- Updating a ChatGPT note leaves one `DocRevision` row. Updating a seeded human note returns the refusal message.
- `pnpm lint && pnpm type-check && pnpm test` pass. With the flag off, `/mcp` returns 404.

## Milestone 2: OAuth works end to end locally

This adds exactly one new risk: authentication.

- **Change — authorization server (single user)**
  - `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. The metadata advertises S256 and a `registration_endpoint`.
  - `/oauth/register` (DCR) persists an `OAuthClient`. `/oauth/authorize` redirects to `/login?next=…` when there is no magic cookie, then shows a one-screen consent page. `/oauth/token` handles authorization_code with PKCE plus a rotating refresh_token.
  - Access tokens are short-lived JWTs signed with `MCP_TOKEN_SECRET`, with `aud` set to the `resource` parameter. Refresh tokens are hashed in an `OAuthGrant` table so they can be revoked. `iss` is included on every authorization response.
- **Change — resource checks**
  - `/mcp` verifies signature, `iss`, `aud`, `exp`, and scope on every call. A failure returns 401 with `WWW-Authenticate` pointing at the resource metadata, and tool errors carry `_meta["mcp/www_authenticate"]`. Each tool declares `securitySchemes: oauth2`.
  - Login gains a safe `next` return-to that only accepts same-origin paths.
  - The dev bearer is removed.
  - Verification: vitest for PKCE mismatch, wrong audience, expired token, and reuse of a revoked or rotated refresh token.

### Desired end state

- The Inspector's OAuth mode registers, sends you to the local login, shows consent, obtains a token, and calls `create_note`.
- A tampered or expired token gets the 401 challenge. Deleting the grant row stops refreshes.

## Milestone 3: ChatGPT saves and finds notes on prod

This is the only live proof. It needs you to deploy and to act in ChatGPT.

- **Change — deploy and connect**
  - Set `MCP_CONNECTOR_ENABLED`, `MCP_TOKEN_SECRET`, and the public base URL in prod, then deploy. The migration runs at container start.
  - Add the connector in ChatGPT developer mode. Allowlist the exact redirect URI it shows.
  - Smoke script: save a plan into a new path, ask a fresh chat to find it, revise it, and confirm that a revision of a human note is refused.
  - Watch the `[mcp]` and `[oauth]` structured logs during the run.

### Desired end state

- One real chat creates and later revises a note on prod, and the version row exists.
- Turning the flag off makes ChatGPT report the connector unavailable.

## Milestone 4: The app shows what ChatGPT did

- **Change — note surfaces:** a "Saved by ChatGPT" marker on the note, and a version list with one-click restore. Restoring also snapshots first.
- **Change — connections:** an admin page that lists OAuth grants (client, created, last used) and can revoke one.
- Verification: a Playwright pass covering the marker, the version popover anchoring, restore, and revoke.

### Desired end state

- You can see, roll back, and cut off ChatGPT's changes without touching the database.

## Milestone 5: Meaning-based recall inside `search`

- **Spike — corpus size for in-process similarity**
  - Decision required: cosine similarity in Node over the `DocEmbedding`/`DocSectionEmbedding` arrays, or pgvector.
  - Evidence to gather: note and section counts on prod, plus query latency.
  - Fallback: pgvector, behind the same service function.
- **Change:** embed new or updated notes on save (async and best-effort) using the active embedding run's model. Embed the query, then merge semantic hits with keyword hits.
- **Evaluate:** 10 real recall questions, compared with keyword only. Keep semantic only if it finds notes that keyword misses.

### Desired end state

- "What did we decide about X" finds a note saved minutes ago that doesn't contain X literally.

## Open decisions and spikes

1. **Transport hosting** (M1 spike above). It decides whether the SDK is used or a hand-written JSON-RPC handler replaces it.
2. **Similarity backend** (M5 spike). It decides between in-process cosine and pgvector.

## Below the cut line

- Tasks, time blocks, and web archive tools. Delete. Edits to notes you wrote.
- CIMD client registration, mTLS or ChatGPT egress-IP allowlisting, and multi-user accounts.
- Snapshots for your own app edits, and diff views between versions.
- Apps SDK UI widgets inside ChatGPT. Changes to the in-app search UI.
