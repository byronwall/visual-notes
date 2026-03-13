# Playwright MCP + Programmatic Testing Guide

This document describes the Playwright test setup in `app/`, how MCP is wired for AI-agent browser automation, and how to run/operate it reliably.

## Scope and context

- App test stack:
  - Unit/integration: Vitest (`pnpm test`)
  - Browser/e2e: Playwright Test (`pnpm test:e2e`)
- Agent browser control: Playwright MCP server (`pnpm mcp:playwright`, isolated by default)
- Repo conventions:
  - Use `pnpm` and `pnpm dlx` only (no `npx`)
  - MCP server entries are configured in `/Users/byronwall/Projects/visual-notes/.mcp.json`

## Major changes delivered

- Added Playwright test config and baseline e2e tests:
  - `/Users/byronwall/Projects/visual-notes/app/playwright.config.ts`
  - `/Users/byronwall/Projects/visual-notes/app/tests/e2e/homepage.spec.ts`
- Added package scripts:
  - `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:json`, `test:e2e:install`, `mcp:playwright`
  - File: `/Users/byronwall/Projects/visual-notes/app/package.json`
- Added MCP server entry for Playwright using `pnpm dlx` in isolated mode:
  - File: `/Users/byronwall/Projects/visual-notes/.mcp.json`
- Updated test isolation so Vitest does not run e2e files:
  - File: `/Users/byronwall/Projects/visual-notes/app/vitest.config.ts`

## Capabilities (Playwright MCP)

Validated via live `tools/list` smoke test. Exposed tools:

- `browser_close`
- `browser_resize`
- `browser_console_messages`
- `browser_handle_dialog`
- `browser_evaluate`
- `browser_file_upload`
- `browser_fill_form`
- `browser_install`
- `browser_press_key`
- `browser_type`
- `browser_navigate`
- `browser_navigate_back`
- `browser_network_requests`
- `browser_run_code`
- `browser_take_screenshot`
- `browser_snapshot`
- `browser_click`
- `browser_drag`
- `browser_hover`
- `browser_select_option`
- `browser_tabs`
- `browser_wait_for`

What this means in practice:

- Full browser task automation from an AI agent (navigate, click, type, upload, assert page state).
- Debug signal capture (console and network requests).
- Visual artifact creation (screenshots, DOM snapshots).
- Scripted interactions for workflows that are hard to express as plain selectors.

## How to use

### 1. Install dependencies

From `/Users/byronwall/Projects/visual-notes/app`:

```bash
pnpm i
pnpm test:e2e:install
```

### 2. Run unit tests

```bash
pnpm test
```

### 3. Run browser tests

```bash
pnpm test:e2e
```

Optional modes:

```bash
pnpm test:e2e:ui
pnpm test:e2e:headed
pnpm test:e2e:json
```

### 4. Run MCP server for agent control

```bash
pnpm mcp:playwright
```

This launches Playwright MCP with `--isolated`, so each spawned server keeps its
browser profile in memory instead of reusing a shared on-disk profile. That
prevents separate Codex threads from contending over the same browser state.

MCP config for clients (already present):

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["dlx", "@playwright/mcp@latest", "--isolated"]
    }
  }
}
```

### 5. Run against an already-running app

For local agent/browser work, assume your app server is already running on port
`3000`. Use the IPv6 loopback address when targeting that local server:

```bash
PLAYWRIGHT_BASE_URL=http://[::1]:3000 pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL` disables Playwright-managed `webServer` bootstrapping.

### 6. Keep app dev server and Playwright running at once

The preferred local setup is to keep your app server running on port `3000` and
point Playwright at it via `http://[::1]:3000`.

If you still want Playwright to manage its own server process, you can override
the port explicitly:

```bash
PLAYWRIGHT_PORT=4100 pnpm test:e2e
```

## Design decisions and tradeoffs

- Use official Microsoft Playwright MCP (`@playwright/mcp`) instead of custom bridge.
  - Benefit: maintained protocol compatibility and standard tooling.
  - Benefit: `--isolated` keeps each MCP server session independent, so concurrent
    Codex threads do not fight over the same persistent browser profile.
  - Tradeoff: when run via `pnpm dlx`, first run depends on external package fetch/cache.
- Keep deterministic e2e tests in `tests/e2e`.
  - Benefit: clear separation from unit tests.
  - Tradeoff: requires explicit Vitest include/exclude rules to avoid cross-runner collisions.
- Use `pnpm`/`pnpm dlx` everywhere.
  - Benefit: consistent package execution policy and lockfile behavior.

## Problems encountered and resolutions

- Problem: Vitest attempted to execute Playwright spec files.
  - Resolution: narrowed Vitest `include` and `exclude` in `/Users/byronwall/Projects/visual-notes/app/vitest.config.ts`.
- Problem: `vinxi dev` failed in this execution sandbox with random-port allocation.
  - Resolution: configured Playwright `webServer.command` to `set -a; source .env; set +a; pnpm build && pnpm start`.
- Problem: MCP `pnpm dlx` may need cache write permission outside restricted sandboxes.
  - Resolution: run with normal local shell permissions or allow elevated execution in restricted environments.

## Verification and validation

Executed checks:

- `pnpm test`:
  - Passed (`src/server/lib/markdown.test.ts`, 7 tests)
- MCP handshake smoke (`initialize`):
  - Passed
  - Server reported `Playwright` version `0.0.68`
- MCP tools discovery smoke (`tools/list`):
  - Passed
  - Reported 22 tools

Notes:

- In restricted sandbox runs, binding/listening on `0.0.0.0:3000` can fail with `EPERM`; that is an environment constraint, not an MCP protocol issue.

## Process improvements

- Keep a dedicated MCP smoke script/check in CI or local preflight:
  - `initialize` + `tools/list` confirms server availability before full automation runs.
- Keep unit and e2e runner boundaries explicit in config to prevent accidental cross-execution.

## Agent/system prompt or skill improvements

- Added/used policy that immediate package executions use `pnpm dlx` (no `npx`).
- Future improvement: add a reusable script target (for example `test:mcp-smoke`) that performs `initialize` + `tools/list` and exits non-zero on protocol errors.

## Follow-ups and open risks

- Open risk: local environment prerequisites (env vars, open port, DB availability) still determine whether end-to-end browser tests can complete.
- Follow-up options:
  - Add a hermetic CI e2e profile with known-good env defaults.
  - Add a lightweight healthcheck route assertion in e2e startup to fail fast on boot misconfiguration.
