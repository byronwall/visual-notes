# ChatGPT MCP connector

The app serves an MCP endpoint at `/mcp` (Streamable HTTP, stateless, JSON responses) so ChatGPT can save notes and find them later. Planning history lives in `docs/intent/chatgpt-mcp-notes/`.

## Tools

| Tool | Kind | Notes |
| --- | --- | --- |
| `search` | read | Reuses the app's server search (`searchDocs`) over titles, paths, and bodies |
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
| `MCP_DEV_TOKEN` | Static bearer for local MCP Inspector runs. Ignored when `NODE_ENV=production`. |
| `PUBLIC_BASE_URL` | Origin used for note links in tool results. |

## Local loop

1. Start the app against a disposable database (see `docs/audit-harness.md`) with `MCP_CONNECTOR_ENABLED=true` and `MCP_DEV_TOKEN=<random>`.
2. Run the smoke script, which uses the official MCP client:

   ```sh
   MCP_URL=http://127.0.0.1:<port>/mcp MCP_BEARER=<token> \
     node --experimental-strip-types scripts/mcp-smoke.ts --human-note <id of a user-written note>
   ```

3. Or explore interactively: `pnpm dlx @modelcontextprotocol/inspector` and connect to the same URL with the bearer header.
