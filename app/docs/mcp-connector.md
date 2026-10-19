# ChatGPT MCP connector

The app serves an MCP endpoint at `/mcp` (Streamable HTTP, stateless, JSON responses) so ChatGPT can save notes and find them later. Planning history lives in `docs/intent/chatgpt-mcp-notes/`.

## Tools

| Tool | Kind | Notes |
| --- | --- | --- |
| `search` | read | Keyword search (the app's `searchDocs`) fused with meaning-based matches. Each result carries `match: keyword | semantic | both`. |
| `list_recent` | read | Newest first; filter by `since`, `path`, `createdBy: "chatgpt"` |
| `list_paths` | read | Dot-path tree with direct and total counts |
| `get_notes` | read | Up to 10 notes as markdown; editor HTML is converted with turndown |
| `create_note` | write | Any path; `idempotencyKey` makes retries safe |
| `update_note` | write | ChatGPT-created notes only; snapshots a `DocRevision` first |
| `append_to_note` | write | Same ownership rule; keeps existing HTML intact |

A note belongs to ChatGPT when `Doc.originalSource = "chatgpt"`. User edits don't change that. Every call is logged as an `ActionEvent` with `actorType = chatgpt`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MCP_CONNECTOR_ENABLED` | `true` serves `/mcp` (and the OAuth routes). Anything else returns 404. This is the kill switch. |
| `MCP_TOKEN_SECRET` | HMAC secret for access tokens. Rotating it invalidates every issued access token. |
| `MCP_DEV_TOKEN` | Static bearer for local MCP Inspector runs. Ignored when `NODE_ENV=production`. |
| `PUBLIC_BASE_URL` | Origin used for note links in tool results. |

## Meaning-based search

When `OPENAI_API_KEY` is set and at least one embedding run exists (`/embeddings`), `search` also embeds the query with the newest run's model. It then ranks notes by cosine similarity against that run's doc vectors and merges the two lists with reciprocal rank fusion. Hits below a 0.25 similarity are dropped.

- Doc vectors are loaded into memory once and reloaded only when the run's embedding count or newest row changes.
- After any connector write, the app waits 10 seconds and then embeds up to 25 missing and 25 changed notes into the newest run, using the same pipeline as a manual run. A note ChatGPT just saved therefore becomes findable by meaning shortly after the save.
- Without a key or a run, or if the provider call fails, `search` falls back to keyword-only results.
- Evaluating it: ask ChatGPT (or call `search`) with about 10 real recall questions whose answer notes don't contain the query words. If `semantic`/`both` matches surface notes that keyword search misses, keep it. If not, the semantic branch can be removed without changing the tool contract.

## OAuth

ChatGPT connects with OAuth 2.1, served by the app itself for its single user:

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/oauth-protected-resource[/mcp]` | RFC 9728 metadata. Served from middleware, because the file router skips dot-folders. |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata: S256 PKCE, dynamic registration, `iss` on responses |
| `/oauth/register` | RFC 7591 dynamic client registration. Public clients only. Redirects must be HTTPS (loopback HTTP is allowed outside production). |
| `/oauth/authorize` | Requires the normal login (via `/login?next=…`), then shows a consent page |
| `/oauth/token` | `authorization_code` with PKCE, and rotating `refresh_token` |

- Access tokens are HS256 JWTs. They live for one hour, have `aud` set to `<origin>/mcp`, and carry the grant id. `/mcp` checks the signature, `iss`, `aud`, `exp`, and that the grant is not revoked, on every call.
- Codes and refresh tokens are stored only as SHA-256 hashes. Codes are single use. A refresh token that has already been rotated is refused.
- Scopes: `notes:read` covers the read tools and `notes:write` covers the write tools. `tools/list` adds a per-tool `securitySchemes` entry, which ChatGPT reads and the MCP SDK doesn't emit.
- To revoke one connection, set `OAuthGrant.revokedAt` (the admin UI comes later). To revoke everything, rotate `MCP_TOKEN_SECRET`.

## Local loop

1. Start the app against a disposable database (see `docs/audit-harness.md`) with `MCP_CONNECTOR_ENABLED=true` and `MCP_DEV_TOKEN=<random>`.
2. Run the smoke script, which uses the official MCP client:

   ```sh
   MCP_URL=http://127.0.0.1:<port>/mcp MCP_BEARER=<token> \
     node --experimental-strip-types scripts/mcp-smoke.ts --human-note <id of a user-written note>
   ```

3. Or explore interactively: `pnpm dlx @modelcontextprotocol/inspector` and connect to the same URL with the bearer header.

## Deploying and connecting ChatGPT

1. Set these on the production app, then deploy. The migrations run at container start.
   - `MCP_CONNECTOR_ENABLED=true`
   - `MCP_TOKEN_SECRET=$(openssl rand -hex 32)`
   - `PUBLIC_BASE_URL=https://<your notes origin>`. Tokens are issued for `<origin>/mcp`, so this must be the public HTTPS URL.
2. Check from outside:
   - `curl https://<origin>/.well-known/oauth-protected-resource/mcp` returns `resource: https://<origin>/mcp`.
   - `curl -i -X POST https://<origin>/mcp` returns `401` with a `WWW-Authenticate` header that has `resource_metadata`.
3. In ChatGPT, turn on developer mode (Settings → Apps & Connectors → Advanced). Create a connector with the URL `https://<origin>/mcp` and OAuth authentication. ChatGPT registers itself, then opens the Visual Notes login and consent page. Approve it.
4. Smoke test in a chat:
   - "Save a short plan about X to my notes." Expect a title, a path (possibly new), and a link that opens in the app.
   - In a new chat: "Find what we saved about X and add a next step." Expect `search` → `get_notes` → `update_note`/`append_to_note`, and a version row for the edit.
   - "Rename my note <title of a note you wrote>." Expect a refusal and an offer to create a linked note.
5. Watch the `[mcp]` and `[oauth]` log lines during the run.

Rollback: set `MCP_CONNECTOR_ENABLED=false`. `/mcp`, `/oauth/*`, and the metadata routes then return 404, and ChatGPT reports the connector unavailable. Notes that were already saved stay as normal notes.
