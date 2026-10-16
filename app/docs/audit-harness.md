# Isolated UI audit harness

Use one app worktree, one assigned port, and a synthetic PostgreSQL database for each audit owner. The launcher starts the development app with a small environment copied from an explicit env file. It replaces the database name, requires a loopback database host, and sets `OPENAI_API_KEY` to an empty value.

## Prepare a worktree

Use Node 22.6 or newer. From that worktree's `app/` directory, install dependencies with the pinned pnpm version and verify Panda generated its import files:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec panda codegen
test -s styled-system/css/index.mjs
```

For a managed worktree outside the shared checkout, grant the requested scoped write access for dependency installation and code generation. Keep each worktree's `node_modules` independent. Use absolute worktree paths and explicit command working directories. Check `git status --short --branch` from the assigned worktree before and after edits.

The launcher does not create a database, apply schema changes, reset data, or delete records. Ask the audit coordinator to provision a blank synthetic database and prepare its schema before starting the app. The env file must contain the local PostgreSQL connection and `AUTH_SECRET`. Pass the file by path; do not copy its contents into a worktree. Set a new local-only `AUDIT_MAGIC_PASSWORD` for the app and `PLAYWRIGHT_MAGIC_PASSWORD` for browser tests. Do not reuse a password from the env file or another running app.

## Start the app

Use an explicitly assigned free port and a database name that starts with `visual_notes_audit_`:

| Owner                  | Port |
| ---------------------- | ---: |
| workflow               | 3111 |
| data                   | 3112 |
| editor                 | 3113 |
| organization           | 3114 |
| harness                | 3115 |
| editor-TOC             | 3116 |
| data-notes-search      | 3117 |
| organization-follow-up | 3118 |
| archive-create-pending | 3121 |

Example for the harness owner:

```sh
corepack pnpm audit:harness:check
export AUDIT_MAGIC_PASSWORD='choose-a-new-test-only-value'
export PLAYWRIGHT_MAGIC_PASSWORD="$AUDIT_MAGIC_PASSWORD"
corepack pnpm audit:harness -- --env-file /path/to/secure/local.env --port 3115 --database visual_notes_audit_harness --worktree /path/to/assigned-worktree --branch codex/assigned-branch
```

Choose a fresh test-only password. The launcher ignores any `MAGIC_PASSWORD` from the env file and requires this explicit value.
The `--worktree` and `--branch` values must match the app's current Git checkout. The launcher rejects another worktree, `main`, and detached worktrees.

The app is available at `http://127.0.0.1:<port>`. Stop it with Ctrl+C. The launcher starts the app only when the port is free and forwards shutdown to its own child process group. It does not kill processes by name or reuse another server.

The persistent audit coordinator owns each long-lived server session and records its worktree, port, and terminal session. Bounded audit workers use that URL and close browser handles they create. They do not stop the coordinator's server.

## Record fixtures and evidence

Keep fixture ownership explicit. Each owner records only IDs returned by that owner's creation responses. Do not copy IDs from another audit or use fixtures from the original database.

```json
{
  "owner": "harness",
  "database": "visual_notes_audit_harness",
  "port": 3115,
  "fixtures": [
    {
      "entityKind": "ArchivedPage",
      "id": "<id from this owner's create response>",
      "createdBy": "<creation action or response>",
      "startUrl": "http://127.0.0.1:3115/archive",
      "title": "<synthetic title>"
    }
  ]
}
```

Use each entity's actual app route in `startUrl`. For example, open an `ArchivedPage` from the Archive Explorer at `/archive`; do not treat its ID as a `/docs/<id>` route. Before reporting a metric or defect, capture the source URL, the visible locator used, and the completed user action. Record the observed result and a screenshot or browser trace when it helps reproduce the finding. Keep those observations separate from guesses about the cause.

When browser code creates a Playwright `Browser` handle, close that handle in a `finally` block with `await browser.close()`. The MCP `browser_close` tool may close only the active page, so it is not a substitute for closing a browser handle created by test code.

Never use the original app database for audit writes. Do not add an OpenAI key to this harness. The launcher sets OPENAI_API_KEY to an empty value.

## Check the PGM ledger

Run the read-only consistency report against a local PGM export before closing out a run:

```sh
corepack pnpm pgm:report --root /abs/path/to/pgm-export --project visual-notes-repository-improvement --repo-root /abs/path/to/worktree
```

It lists implemented nodes without a solution, open nodes that already record a solution (review their disposition), duplicate titles, invalid parents, thin open records, and referenced `tmp/`, `docs/`, or `app/` evidence paths that do not exist under `--repo-root`. Add `--json` for machine-readable output. It never edits or deletes nodes and does not start the PGM viewer.
