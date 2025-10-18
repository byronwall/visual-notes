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

## Embeddings + UMAP (New)

This app now supports computing OpenAI embeddings for each stored document and generating UMAP projections for visualization. The client canvas at `/visual` will automatically use the latest UMAP run to position notes (falls back to a seeded layout if no run exists).

### UI pages

- `/embeddings` — Create a new embedding run and view recent runs
- `/embeddings/[id]` — View a run, delete it, and trigger a UMAP run (2D/3D)
- `/umap` — Create a UMAP run for a selected embedding run and view recent runs
- `/umap/[id]` — View a UMAP run, delete it, and preview the first 48 points
- `/visual` — Canvas visualization; uses the latest UMAP run if present

### Environment

Set these in your shell or via Compose (see below):

- `OPENAI_API_KEY`: Required to call OpenAI embeddings API
- `EMBEDDING_MODEL`: Model id (default `text-embedding-3-small`)

The Compose file already passes through `OPENAI_API_KEY` and sets a default for `EMBEDDING_MODEL`.

### Database models

- `EmbeddingRun(id, model, dims, params, createdAt)`
- `DocEmbedding(id, runId, docId, vector Float[], createdAt)`
- `UmapRun(id, embeddingRunId, dims, params, createdAt)`
- `UmapPoint(id, runId, docId, x, y, z?)`

Embeddings are stored as `Float[]` for simplicity (no `pgvector` required). UMAP points are stored per-run so multiple runs can coexist.

### API endpoints

- `POST /api/embeddings/runs` → Computes embeddings for all docs and creates a new `EmbeddingRun`.
  - Body (optional): `{ "model": "text-embedding-3-small" }`
  - Response: `{ runId, count }`
- `GET /api/embeddings/runs` → Lists recent embedding runs
- `GET /api/embeddings/runs/[id]` → Returns a single run with `{ id, model, dims, params, createdAt, count }`
- `PATCH /api/embeddings/runs/[id]` → Update `model`, `dims`, or `params` metadata
- `DELETE /api/embeddings/runs/[id]` → Deletes the run and its `DocEmbedding` rows

- `POST /api/umap/runs` → Creates a UMAP projection for a given embedding run
  - Body: `{ "embeddingRunId": string, "dims": 2 | 3, "params"?: { "nNeighbors"?: number, "minDist"?: number, "metric"?: "cosine" | "euclidean" } }`
  - Response: `{ jobId: null, runId }`
- `GET /api/umap/runs` → Lists recent UMAP runs
- `GET /api/umap/runs/[id]` → Returns a single run with `{ id, dims, params, embeddingRunId, createdAt, count }`
- `PATCH /api/umap/runs/[id]` → Update `dims` or `params` metadata
- `DELETE /api/umap/runs/[id]` → Deletes the run and its `UmapPoint` rows
- `GET /api/umap/points?runId=...` → Returns `{ runId, dims, points: [{ docId, x, y, z? }], meta: { count } }`

### Quickstart: embeddings → UMAP → visualize

1. Ingest a few docs (see earlier examples), then compute embeddings:

```bash
curl -s -X POST http://localhost:3000/api/embeddings/runs \
  -H 'Content-Type: application/json' \
  -d '{"model":"text-embedding-3-small"}' | jq .
```

2. List embedding runs and pick one:

```bash
curl -s http://localhost:3000/api/embeddings/runs | jq .
```

3. Create a UMAP run from that embedding run:

```bash
EMB_RUN_ID="<paste-from-step-2>"
curl -s -X POST http://localhost:3000/api/umap/runs \
  -H 'Content-Type: application/json' \
  -d "{\"embeddingRunId\":\"$EMB_RUN_ID\",\"dims\":2,\"params\":{\"nNeighbors\":15,\"minDist\":0.1,\"metric\":\"cosine\"}}" | jq .
```

4. Open the canvas at `http://localhost:3000/visual`. The latest UMAP run is fetched automatically to position notes.

### Per-run examples (detail, update, delete)

Embedding run detail:

```bash
curl -s http://localhost:3000/api/embeddings/runs/<runId> | jq .
```

Update embedding run metadata:

```bash
curl -s -X PATCH http://localhost:3000/api/embeddings/runs/<runId> \
  -H 'Content-Type: application/json' \
  -d '{"params":{"note":"my tag"}}' | jq .
```

Delete embedding run (also removes vectors):

```bash
curl -s -X DELETE http://localhost:3000/api/embeddings/runs/<runId> | jq .
```

UMAP run detail:

```bash
curl -s http://localhost:3000/api/umap/runs/<runId> | jq .
```

Delete UMAP run (also removes points):

```bash
curl -s -X DELETE http://localhost:3000/api/umap/runs/<runId> | jq .
```

### Docker (embeddings + UMAP)

Pass your OpenAI key when starting Compose:

```bash
cd app
OPENAI_API_KEY=sk-... EMBEDDING_MODEL=text-embedding-3-small \
  docker compose up --build
```

The `app/docker-compose.yml` forwards `OPENAI_API_KEY` and sets a default `EMBEDDING_MODEL`. On container start, Prisma migrations are applied before serving.
