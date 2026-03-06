# UMAP Runtime Architecture

This document describes where each UMAP-related piece runs and where its data is stored.

## Runtime Topology

### Browser (client UI)
- Runs in the user browser.
- Surfaces UMAP controls on:
  - `/embeddings/[id]` (start train run)
  - `/umap` (configure and start train run)
  - `/visual` (consume latest UMAP points for layout)
- Does not run UMAP math directly.

### App server (Node/SolidStart)
- Runs in the `app` process (local `pnpm dev`/`pnpm start` or Docker `app` service).
- Owns API/query/action orchestration:
  - Embedding run creation and incremental processing.
  - UMAP run creation (train orchestration).
  - UMAP projection for fresh embeddings (transform orchestration).
- Reads/writes PostgreSQL via Prisma.
- Spawns Python subprocesses for UMAP train/transform.

### Python UMAP worker (subprocess)
- Executed by Node via `python3 scripts/umap_model.py`.
- Uses `umap-learn`, `scikit-learn`, `numpy`, `joblib`.
- Responsibilities:
  - `train`: fit UMAP (and optional PCA), return initial coordinates, persist model artifact.
  - `transform`: load persisted artifact, project new vectors without retraining.
  - `check`: dependency health check.
- It is not a standalone service; it is invoked on demand per action.

### PostgreSQL
- Stores all authoritative app data:
  - Source docs (`Doc`, `DocSection`)
  - Embeddings (`EmbeddingRun`, `DocEmbedding`, `DocSectionEmbedding`)
  - UMAP metadata and coordinates (`UmapRun`, `UmapPoint`)
- `UmapRun.artifactPath` stores the filesystem location reference to the persisted model.

### Filesystem
- Stores persisted UMAP artifacts (`.joblib`):
  - Default local path: `app/data/umap-models`
  - Docker default path: `/app/data/umap-models`
- Also used for short-lived temp JSON files for Node<->Python IPC (`/tmp`).

## Storage Map

### Database (Postgres)
- `EmbeddingRun`: embedding model + run metadata.
- `DocEmbedding.vector`: pooled full-doc vectors (`Float[]`).
- `UmapRun`: UMAP metadata (`dims`, `params`, `embeddingRunId`, `artifactPath`).
- `UmapPoint`: projected coordinates per doc (`x`, `y`, optional `z`).

### Disk (app container or local app dir)
- `UMAP_MODEL_DIR/<umapRunId>.joblib`: serialized trained reducer (+ optional PCA).
- Docker volume: `app-data` is mounted to `/app/data`, so artifacts persist across container restarts.

## Key Execution Flows

### Train flow (`createUmapRun`)
1. Browser triggers UMAP run.
2. Node reads all `DocEmbedding` rows for the selected `EmbeddingRun`.
3. Node invokes Python `train`.
4. Python fits reducer and writes artifact to disk.
5. Node writes:
   - `UmapRun` (with `artifactPath`)
   - `UmapPoint` rows for current docs

### Incremental projection flow (`projectUmapRun`)
1. Node reads persisted `UmapRun` + `artifactPath`.
2. Node loads target embeddings (all, or selected `docIds`).
3. Node invokes Python `transform` with new vectors.
4. Node upserts corresponding `UmapPoint` rows (without retraining).

### Auto-projection after embedding updates (`processEmbeddingRun`)
1. Node computes embeddings for new/changed docs.
2. Node checks for trained UMAP runs on that same `EmbeddingRun`.
3. For each trained run, Node projects fresh vectors through persisted artifact.
4. New points become immediately available to `/visual`.

## Deployment Notes

### Local
- Install Python deps once:
  - `cd app && pnpm umap:python:install`
- Validate:
  - `pnpm umap:python:check`

### Docker
- `app` image includes Python + UMAP deps.
- `docker-compose` passes:
  - `UMAP_PYTHON_BIN` (default `python3`)
  - `UMAP_MODEL_DIR` (default `/app/data/umap-models`)
- Artifacts persist in `app-data` volume; DB persists in `db-data`.
