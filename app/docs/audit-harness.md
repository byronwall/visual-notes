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

The launcher does not create a database, apply schema changes, reset data, or delete records. Ask the audit coordinator to provision a blank synthetic database and prepare its schema before starting the app. The env file must contain the local PostgreSQL connection and `AUTH_SECRET`. Pass the file by path; do not copy its contents into a worktree. Create a new test-only credential file for each run and point both the app and browser tests at it. Do not reuse a password from the env file or another running app.

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
umask 077 && openssl rand -hex 16 > "$TMPDIR/vn-audit-<owner>.password"
export AUDIT_MAGIC_PASSWORD_FILE="$TMPDIR/vn-audit-<owner>.password"
export PLAYWRIGHT_MAGIC_PASSWORD_FILE="$TMPDIR/vn-audit-<owner>.password"
corepack pnpm audit:harness -- --env-file /path/to/secure/local.env --port 3115 --database visual_notes_audit_harness --worktree /path/to/assigned-worktree --branch codex/assigned-branch
```

The launcher ignores any `MAGIC_PASSWORD` from the env file and requires this explicit value. Browser tests refuse a credential file that is readable by group or others, and they skip the local `.env` fallback whenever `PLAYWRIGHT_BASE_URL` is set. Delete the credential file when the owner stops the run.
The `--worktree` and `--branch` values must match the app's current Git checkout. The launcher rejects another worktree, `main`, and detached worktrees.

The app is available at `http://127.0.0.1:<port>`. Stop it with Ctrl+C. The launcher starts the app only when the port is free and forwards shutdown to its own child process group. It does not kill processes by name or reuse another server.

The persistent audit coordinator owns each long-lived server session and records its worktree, port, and terminal session. Bounded audit workers use that URL and close browser handles they create. They do not stop the coordinator's server.

## Record the run

Pass `--owner`, `--run-manifest`, and optionally `--fixtures` and `--evidence` (absolute paths) to the launcher. It writes one JSON run manifest with the source root, branch, commit, a hash of uncommitted changes, the port, the database name, launcher and server PIDs, and the fixture and evidence paths. It never records the database URL or credentials. The launcher records server shutdown itself; record page and browser closure as separate facts:

```sh
corepack pnpm audit:harness -- <launcher options> --owner harness --run-manifest /abs/evidence/run.json --fixtures /abs/evidence/fixtures.json --evidence /abs/evidence
corepack pnpm audit:run mark --manifest /abs/evidence/run.json --closed page
corepack pnpm audit:run mark --manifest /abs/evidence/run.json --closed browser
corepack pnpm audit:run verify --manifest /abs/evidence/run.json --artifact shot.png
```

`verify` prints the run identity and shutdown state, then fails if the source changed since launch, the fixture manifest is missing or belongs to another owner or database, the evidence directory is missing, or a named artifact (relative to the evidence directory) is absent. Files under the manifest, fixture, and evidence paths do not count as source changes. A source mismatch invalidates the proof; do not rebase or restart to make it pass. Whether the evidence is sufficient remains the reviewer's call.

## Record fixtures and evidence

Keep fixture ownership explicit. Each owner records only IDs returned by that owner's creation responses. Do not copy IDs from another audit, infer ownership from titles or recent activity, or use fixtures from the original database.

Record each fixture right after its create response, then clean up only through the same manifest:

```sh
corepack pnpm audit:fixtures record --manifest /abs/evidence/fixtures.json --owner harness --database visual_notes_audit_harness --kind Doc --id <id from create response> --route http://127.0.0.1:3115/docs/<id> --title "<synthetic title>"
corepack pnpm audit:fixtures cleanup --manifest /abs/evidence/fixtures.json --owner harness --database visual_notes_audit_harness --id <id> --dry-run
corepack pnpm audit:fixtures cleanup --manifest /abs/evidence/fixtures.json --owner harness --database visual_notes_audit_harness --id <id> --env-file /path/to/secure/local.env
```

Supported kinds are `Doc`, `ArchivedPage`, `TaskList`, and `TimeBlock`. Cleanup refuses an ID absent from the owner's manifest, a different owner or database, or a kind mismatch, and it checks all of these before connecting. It deletes one row by its exact ID from the loopback synthetic database and then removes the entry from the manifest. Cleanup still needs the coordinator's authorization; the command only limits what an authorized cleanup can touch.

The manifest looks like this:

```json
{
  "owner": "harness",
  "database": "visual_notes_audit_harness",
  "fixtures": [
    {
      "entityKind": "ArchivedPage",
      "id": "<id from this owner's create response>",
      "route": "http://127.0.0.1:3115/archive",
      "title": "<synthetic title>",
      "createdBy": "<creation action or response>"
    }
  ]
}
```

Use each entity's actual app route in `route`. For example, open an `ArchivedPage` from the Archive Explorer at `/archive`; do not treat its ID as a `/docs/<id>` route. Before reporting a metric or defect, capture the source URL, the visible locator used, and the completed user action. Record the observed result and a screenshot or browser trace when it helps reproduce the finding. Keep those observations separate from guesses about the cause.

Playwright global setup signs in once, outside the traced test run, and saves the session to `playwright/.auth/user.json`. Tests start from that session. `ensureAuthed(page)` never types the real credential inside a test, because traces record filled values; pass `{ password }` only for a mocked fixture page. Keep request headers and bodies out of reports unless a finding needs them.

When browser code creates a Playwright `Browser` handle, close that handle in a `finally` block with `await browser.close()`. The MCP `browser_close` tool may close only the active page, so it is not a substitute for closing a browser handle created by test code.

Never use the original app database for audit writes. Do not add an OpenAI key to this harness. The launcher sets OPENAI_API_KEY to an empty value.

## Hand off work

Give each accepted change one current handoff instead of a stream of status messages. Update it when the source, proof, or limits change.

```md
- Source: <absolute worktree path> @ <branch> <short head SHA>
- PR: <number> (base <base branch>)
- Proof: <evidence paths, relative to the worktree>
- Checks: lint / type-check / test results, or "not run"
- Limits: what the proof does not cover
```

Before rebasing or restacking PRs, save each PR's current body, head, and base so screenshots and history can be compared afterwards:

```sh
gh pr view <number> --json number,title,body,headRefName,headRefOid,baseRefName > tmp/pr-<number>-before.json
```
