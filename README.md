# Visual Notes

## Minimal Markdown Ingest Slice

This repo includes a minimal end-to-end slice to ingest a single Markdown document via API, persist it, and view it on the client. Images are intentionally omitted for now.

### What was added

- Minimal Prisma model `Doc` with `title`, `markdown`, `html`, timestamps
- API routes to ingest and fetch a document
- Home page with a simple ingest form that navigates to the document viewer
- Viewer page that renders the stored HTML
- Vitest integration test that mocks Prisma and exercises ingest + fetch

## Getting Started

### Prerequisites

- Node.js and pnpm
- Postgres if you want to run against a real DB locally (Compose file available)

### Install deps and generate Prisma

```bash
cd app
pnpm install
pnpm prisma generate
```

### Create database schema (dev)

```bash
pnpm push
```

### Run the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

## API

### POST /api/docs

Ingest a Markdown document. Returns the created `id`.

Request body:

```json
{ "title": "My Doc", "markdown": "# Hello\nSome text." }
```

Example:

```bash
curl -s -X POST http://localhost:3000/api/docs \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","markdown":"# Hello\nSome text."}'
```

Response:

```json
{ "id": "doc_123" }
```

### GET /api/docs/[id]

Fetch a previously ingested document.

Response body:

```json
{
  "id": "doc_123",
  "title": "Hello",
  "html": "<h1>Hello</h1>\n<p>Some text.</p>"
}
```

Notes:

- The server converts Markdown to HTML using `normalizeAiOutputToHtml`.
- Authentication is not enforced for this minimal slice.

## Client Usage

- Open the home page and paste Markdown into the ingest form; upon success, you will be navigated to `/docs/[id]` to view it.

## Key Files

- Prisma model: `app/prisma/schema.prisma` (model `Doc`)
- Markdown normalization: `app/src/server/lib/markdown.ts`
- API handlers:
  - `app/src/routes/api/docs/index.ts` (POST)
  - `app/src/routes/api/docs/[id].ts` (GET)
- Client routes:
  - Ingest form (home): `app/src/routes/index.tsx`
  - Viewer: `app/src/routes/docs/[id].tsx`

## Testing

### Run tests

```bash
cd app
pnpm test
```

### What’s tested

- `app/src/routes/api/docs/index.test.ts` runs an integration-style test that:
  - Mocks Prisma via `vi.spyOn(db, "prisma", "get")`
  - Calls POST `/api/docs` handler and then GET `/api/docs/[id]`
  - Verifies the created id and returned HTML

## Docker Quickstart

A minimal Compose setup lives in `app/docker-compose.yml` and runs Postgres + the app. No external APIs are required for the minimal Markdown ingest flow.

### One-liner

```bash
cd app && docker compose up --build
```

Then open `http://localhost:3000`.

### What it does

- Starts Postgres (`db`) with default credentials and database `visual_notes`.
- Builds the app image, then runs it on port 3000.
- On container start, the app runs `prisma migrate deploy` automatically.

### Environment (overrides)

In case you need to override ports or database settings:

```bash
# App port mapping (host:container)
APP_PORT=3000 \

# DB settings used by Compose and to construct DATABASE_URL
DB_USER=postgres \
DB_PASSWORD=postgres \
DB_NAME=visual_notes \
DB_PORT_EXPOSED=5432 \
docker compose up --build
```

Inside the app container, `DATABASE_URL` is set to `postgresql://postgres:postgres@db:5432/visual_notes?schema=public` by default.

### Test the API (optional)

```bash
curl -s -X POST http://localhost:3000/api/docs \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","markdown":"# Hello\nSome text."}' | jq .
```
