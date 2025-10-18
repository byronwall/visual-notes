# App Plan

## Current state

We have a long PRD that describes overall goals. NEed to buid out a speciifc plan for the app portion.

I cloned an existing SolidStart app in the `app` directory. We will use this as a starting point. It has a TON of stuff that needs ripped out. But the core structure is all correct. Assume if somethign looks reaosnable in the app or DB or config, it hsould jsut stay for now. The cloned app was a daily bible reading app for reference.

We will need to build out the server features, client features, and hten batch backgorund features. Build a plan for each of these. Then discuss integration points.

The server will then need to be integrated with the ingest CLI.

A separate document will plan out the ingest CLI once the server is scoped.

## Overall architecture

High-level components and data flow (single-user deployment):

- **CLI (Python)**: Extracts Apple Notes → converts to markdown + attachment files → computes `contentHash` → batches up to 100 most-recently-edited → uploads via bearer-auth to server.
- **Server (SolidStart/Node)**: Accepts ingest, persists `Note`/`NoteVersion`/`Attachment`, dedupes by `contentHash`, enqueues jobs (`chunk`, `embed`). Exposes search, UMAP, AI actions, export, and job status APIs.
- **DB (Postgres + Prisma)**: Core relational store. `pgvector` for embeddings. Job and log tables for progress + observability.
- **Background jobs (same Node runtime, DB-coordinated)**: Deterministic pipeline: `chunk` → `embed` → (manual) `umap`. AI actions run as jobs with strict caps. Jobs are idempotent and resume by skipping already-processed units.
- **Client (SolidStart app)**: Infinite canvas for UMAP points, search bar (hybrid filtering), side reader panel, lasso selection, Voronoi overlay, job center.

Data flow (happy path):

1. CLI `POST /api/ingest/notes` (≤100MB request) with JSON manifest + multipart attachments.
2. Server upserts notes by `contentHash`; for each new/changed `NoteVersion`, create a `chunk` job.
3. `chunk` produces `Chunk` rows and a `chunkingRun`; enqueues `embed` jobs for full note + chunks tied to an `embeddingRun`.
4. User later triggers `POST /api/umap/runs` to generate 2D/3D projections; canvas reads `GET /api/umap/points?runId=...`.
5. Search `GET /api/search` blends keyword (FTS/BM25) with vector similarity; results filter the canvas.
6. User lasso-selects (capped to ≤10 notes or ~10k tokens) → `POST /api/ai/actions` creates a new `Note`/`NoteVersion` with provenance links.
7. Export selected ids via `POST /api/export` (ZIP or text response).

## Server implementation

- **Runtime:** SolidStart API routes under `app/src/routes/api/*`. Single-user bearer auth middleware for sensitive routes (ingest, AI, export, runs).
- **Config:** `.env` for `DATABASE_URL`, `BEARER_TOKEN`, `EMBEDDING_MODEL`, `OPENAI_API_KEY` (or provider), default UMAP params, and limits.
- **Auth:**
  - Public: `GET /api/umap/runs`, `GET /api/umap/points`, `GET /api/notes/:id`, `GET /api/search` (OK in private single-user deployment). Optionally gate behind bearer later.
  - Token required: `POST /api/ingest/notes`, `POST /api/umap/runs`, `POST /api/ai/actions`, `POST /api/export`.
- **Jobs:** `Job(type,status,progress,createdAt,updatedAt,error)`; mutating routes create jobs and return `jobId`. Workers poll DB for `pending` jobs.
- **Idempotency:**
  - Ingest: verify `contentHash`; if exists, skip create and return existing ids.
  - Chunk/Embed: keyed `ChunkingRun`/`EmbeddingRun` by params; skip existing.
- **Logging:** Structured logs with optional `jobId` + `data`; expose recent logs by `jobId`.
- **Search:** Combine Postgres FTS (or `tsvector`) with pgvector cosine similarity; static weighted blend.
- **Errors:** 400 validation/limits; 401 missing/invalid token; 413 size; 429 caps; 500 unexpected.

## Data model (Prisma outline)

- `User(id uuid)` single row for now.
- `Note(id uuid, latestVersionId uuid?, createdAt, updatedAt)`
- `NoteVersion(id uuid, noteId, title, markdown, contentHash sha256, createdAt)`
- `Attachment(id uuid, noteVersionId, filename, mimeType, bytes int, sha256, storagePath, createdAt)`
- `ChunkingRun(id uuid, noteVersionId, params jsonb, createdAt)`
- `Chunk(id uuid, chunkingRunId, noteVersionId, index int, text, tokenCount int, createdAt)`
- `EmbeddingRun(id uuid, model string, dims int, params jsonb, createdAt)`
- `Embedding(id uuid, runId, targetType enum('NoteVersion','Chunk'), targetId uuid, vector vector(dims))`
- `UmapRun(id uuid, embeddingRunId, dims int, params jsonb, createdAt)`
- `UmapPoint(id uuid, runId, noteId, x float8, y float8, z float8?)`
- `Job(id uuid, type enum('ingest','chunk','embed','umap','ai','export'), status enum('pending','running','succeeded','failed'), progress float4, error text?, createdAt, updatedAt)`
- `Log(id uuid, jobId uuid?, level enum('debug','info','warn','error'), message text, data jsonb?, createdAt)`
- `NoteProvenance(id uuid, generatedNoteVersionId, sourceNoteVersionId, action enum('summarize','compare','extract_tasks','tags','merge'), createdAt)`

Indexes:

- Unique: `NoteVersion.contentHash`; `Attachment.sha256` scoped by `noteVersionId`.
- Vector: HNSW index on `Embedding.vector` (cosine).
- FTS: `tsvector` index on `NoteVersion(title, markdown)`.

## API contracts (v1)

- `POST /api/ingest/notes`

  - Auth: bearer token
  - Body: multipart with `manifest.json` + files; or JSON with base64 small attachments.
  - `manifest.json`:

    ```json
    {
      "batchId": "string",
      "notes": [
        {
          "appleNoteId": "string",
          "title": "string",
          "markdown": "string",
          "attachments": [
            {
              "filename": "img.png",
              "mime": "image/png",
              "bytes": 12345,
              "sha256": "hex",
              "relPath": "attachments/img.png"
            }
          ],
          "contentHash": "sha256-of({markdown,sorted-attachments})"
        }
      ]
    }
    ```

  - Response: `{ jobId, createdNoteVersionIds: string[], updatedNoteVersionIds: string[] }`

- `GET /api/jobs/:id` → `{ id, type, status, progress, error?, logs: {level,message,createdAt}[] }`

- `GET /api/search?q=...&runId=...&limit=...` → `{ results: [{ noteId, score, title, snippet }], usedRunId }`

- `GET /api/umap/runs` → `{ runs: [{ id, dims, params, embeddingRunId, createdAt }] }`

- `POST /api/umap/runs`

  - Auth: bearer
  - Body: `{ embeddingRunId: string, dims: 2|3, params?: { nNeighbors?: number, minDist?: number, metric?: "cosine"|"euclidean" } }`
  - Response: `{ jobId, runId }`

- `GET /api/umap/points?runId=...` → `{ runId, dims, points: [{ noteId, x, y, z? }], meta: { count } }`

- `GET /api/notes/:id` → `{ id, latestVersion: { id, title, markdown, attachments: [{filename,url,mime,bytes}] }, provenance: [{ sourceNoteVersionId, action }] }`

- `POST /api/ai/actions`

  - Auth: bearer
  - Body: `{ action: "summarize"|"compare"|"extract_tasks"|"tags"|"merge", noteIds: string[] (<=10), params?: object }`
  - Response: `{ jobId, generatedNoteId }`

- `POST /api/export`
  - Auth: bearer
  - Body: `{ noteIds: string[] (<=100), format: "zip"|"text" }`
  - Response: `application/zip` or `{ text: string }`

## Background processing

- **Workers:** In-process loop reads `Job` rows; transitions `pending`→`running`→`succeeded/failed`; update `progress`.
- **Chunking:** split by headings/paragraphs/lists; cap tokens (≈800–1200); allow standalone image chunks with caption context. Output `ChunkingRun` + `Chunk[]`.
- **Embedding:** vectors for full `NoteVersion` + each `Chunk` under an `EmbeddingRun` (model/dims/params). Idempotent per `(runId,targetType,targetId)`.
- **UMAP:** trigger via API; source vectors from selected full-note `EmbeddingRun`. Start with `umap-js`; fall back to Python `umap-learn` if needed. Persist `UmapRun` + `UmapPoint`.
- **AI actions:** enforce ≤10 notes or ~10k tokens; deterministic trim; create new `Note`/`NoteVersion`; add `NoteProvenance` rows; optional backlinks in body.
- **Export:** stream ZIP (markdown + attachments) or return concatenated text.

## Client implementation

- **Tech:** SolidStart; canvas 2D first (10k points). Abstract renderer for future WebGL.
- **State:** active `UmapRun`, search query, filtered ids, selection set, open note in side panel.
- **Components:** `CanvasView` (pan/zoom, hover, lasso, quadtree hit-test), `VoronoiOverlay` (toggle), `SidePanel` (note + chunk boundaries), `SearchBar`, `RunSwitcher`, `JobsCenter`.
- **Perf:** cache `GET /api/umap/points` per run; filter client-side; paint only visible; aim 45+ FPS.

## CLI integration & auth

- **Bearer auth:** `Authorization: Bearer <token>` from CLI config.
- **Limits:** request ≤100MB; item ≤10MB; clear per-item errors.
- **Manifest & files:** CLI sends manifest + relative paths; server stores, rewrites display URLs.
- **Idempotency:** server verifies `contentHash`; skips duplicates; returns created/updated ids.
- **Retries:** CLI retries 5xx; server is idempotent.

## Limits & acceptance (enforced)

- Ingest ≤100 notes/run; request ≤100MB; item ≤10MB; exclude audio/video.
- AI ≤10 notes or ~10k tokens.
- Export ≤100 items.
- Jobs restart from beginning; guards skip processed units.
- Acceptance: vectors after ingest; at least one UMAP 2D run; canvas interactions; provenance; search filters canvas.

## next steps

1. Draft Prisma schema and generate migrations for core tables.
2. Implement `POST /api/ingest/notes` with bearer auth, limits, and job creation.
3. Build job runner loop and `chunk` implementation; then `embed` with pgvector.
4. Implement `GET /api/search` (FTS + pgvector) and indexes.
5. Implement `POST /api/umap/runs` and `GET /api/umap/points` using `umap-js`.
6. Build client canvas, search, side panel, lasso, Voronoi overlay.
7. Implement `POST /api/ai/actions` with provenance and caps.
8. Implement `POST /api/export` streaming ZIP; add JobsCenter UI.
9. Smoke test end-to-end with a small ingest; iterate on performance.

## Progress tracking
