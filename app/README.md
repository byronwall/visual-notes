# Visual Notes

Small Solid app that ingests a Markdown document via API and displays a rendered HTML view. Backed by Prisma/Postgres. Optional auth and AI features exist but are not required for the minimal ingest slice.

## Features

- **Import**: CSV/TSV or paste text with headers like `Date, Psalm, Old Testament, New Testament`.
- **Progress**: Server-managed reading progress with per-passage state and "mark day complete".
- **Reader**: Modal fetches formatted HTML from Crossway ESV API (headings, poetry, verse numbers).
- **Attribution**: ESV short copyright attribution shown in the reader.
- **AI Summary**: One-click AI chapter summary rendered above the passage, cached per passage, with an expandable details view.

### Embeddings + UMAP (new UI)

- Navigate via the top navbar: `Embeddings`, `UMAP`, and `Canvas`.
- `Embeddings` page lets you start a new embeddings run and browse runs.
- `Embeddings > [run]` lets you delete the run and start a UMAP run (2D/3D).
- `UMAP` page lets you choose an embeddings run and create a UMAP projection.
- `UMAP > [run]` shows run info and a small points preview (first 48).
- `Canvas` uses the latest UMAP run to place notes; otherwise it falls back to a seeded layout.
- UMAP runs are Python-backed (`umap-learn`) and persist a model artifact so new embeddings can be projected later without retraining.

## Getting started

1. Install deps

```bash
pnpm i
```

For persisted UMAP train/transform support, install Python deps once:

```bash
pnpm umap:setup:local
```

2. Environment variables

Recommended set (used by server/auth/db). For the minimal ingest slice, only the DB values are needed when not using Docker Compose:

```
# Auth / app
AUTH_SECRET=dev-secret-change-me
AUTH_TRUST_HOST=true
AUTH_URL=http://localhost:3000
VITE_AUTH_PATH=/api/auth

# Database (optional outside Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=visual_notes

# Prisma/Auth connection string
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
```

3. Run dev server

```bash
pnpm dev
```

Open <http://localhost:3000>. Paste Markdown and click Ingest to navigate to the viewer.

## Optional AI Summary

Optional AI summarization features exist and are disabled by default. To enable, set `OPENAI_API_KEY` and see server code under `src/server/features/*`.

## API

- `POST /api/docs` – ingest a Markdown document: `{ title, markdown }`
- `GET /api/docs/[id]` – fetch an ingested document as HTML

## Scripts

- `pnpm dev` – start the dev server
- `pnpm build` – production build
- `pnpm start` – start the production server
- `pnpm test` – run unit tests (Vitest)
- `pnpm test:e2e` – run Playwright e2e tests
- `pnpm test:e2e:ui` – open Playwright UI mode
- `pnpm test:e2e:headed` – run Playwright in headed mode
- `pnpm test:e2e:json` – run Playwright with machine-readable JSON report
- `pnpm test:e2e:install` – install Chromium for Playwright
- `pnpm mcp:playwright` – start the Playwright MCP server

## Agentic + MCP Testing

This repo is now wired for both code-level and browser-level automation:

- `@playwright/test` for deterministic e2e runs against the app.
- Playwright MCP server (`@playwright/mcp`) so an AI agent can control the browser via MCP tools.

Typical setup:

```bash
pnpm i
pnpm test:e2e:install
```

Typical CI/agent run:

```bash
pnpm test:e2e:json
```

Notes:

- Playwright config is at `playwright.config.ts`.
- Tests live under `tests/e2e`.
- By default, Playwright targets `http://127.0.0.1:3100` and starts its own server on port `3100`.
- Override the default port with `PLAYWRIGHT_PORT`, for example `PLAYWRIGHT_PORT=4100 pnpm test:e2e`.
- To use an already-running environment, set `PLAYWRIGHT_BASE_URL` and run `pnpm test:e2e`.
- Detailed guide: see `docs/playwright-mcp-testing-guide.md`.

## Docker

See the root `README.md` for a concise Docker Quickstart using `app/docker-compose.yml`.

## Notes

- Minimal ingest flow requires only Postgres.

## SSR-first UI convention

- Build UI to render correctly in SSR by default.
- Keep server HTML and first client render structurally consistent to avoid hydration churn and loading stalls.
- Avoid `onMount`-only control rendering for normal form controls (selects, filters, inputs) unless there is a hard browser-only dependency.
- For responsive layouts, prefer CSS breakpoint visibility over runtime viewport branches that remount page content.

## Next steps

- Search plan and filter by incomplete.
- Import/export JSON (plan + progress).
- Column mapper for arbitrary table formats.
- Deep-link routes (e.g., `/read/Amos%205`).
- Store ESV key via UI prompt for deployment without `.env.local`.
- Optional cloud sync using Supabase.

## ESV API details

Link: <https://api.esv.org/account/daily-bible/>
