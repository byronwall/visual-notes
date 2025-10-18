# Visual Notes

Small Solid app that ingests a Markdown document via API and displays a rendered HTML view. Backed by Prisma/Postgres. Optional auth and AI features exist but are not required for the minimal ingest slice.

## Features

- **Import**: CSV/TSV or paste text with headers like `Date, Psalm, Old Testament, New Testament`.
- **Progress**: Server-managed reading progress with per-passage state and "mark day complete".
- **Reader**: Modal fetches formatted HTML from Crossway ESV API (headings, poetry, verse numbers).
- **Attribution**: ESV short copyright attribution shown in the reader.
- **AI Summary**: One-click AI chapter summary rendered above the passage, cached per passage, with an expandable details view.

## Getting started

1. Install deps

```bash
pnpm i
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

## Docker

See the root `README.md` for a concise Docker Quickstart using `app/docker-compose.yml`.

## Notes

- Minimal ingest flow requires only Postgres.

## Next steps

- Search plan and filter by incomplete.
- Import/export JSON (plan + progress).
- Column mapper for arbitrary table formats.
- Deep-link routes (e.g., `/read/Amos%205`).
- Store ESV key via UI prompt for deployment without `.env.local`.
- Optional cloud sync using Supabase.

## ESV API details

Link: <https://api.esv.org/account/daily-bible/>
