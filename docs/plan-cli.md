# CLI Plan

## Goal & Scope

- Goal: A Python CLI that extracts Apple Notes, converts to markdown with attachments, computes canonical content hashes, batches recently edited items, and uploads to the server using the defined API. It reports progress, handles retries, and is safe to run repeatedly (idempotent).
- Scope (v1): Incremental ingest only (top 100 recently edited). No deletion propagation, no local vector work, no AI actions from CLI. Optional convenience commands to check job status.

## Role in Architecture

- CLI runs on macOS where Apple Notes data exists.
- Produces a JSON manifest plus attachment files on disk.
- Sends a single multipart request to the server: `POST /api/ingest/notes` with bearer token.
- Reads job id from the server response and optionally polls `GET /api/jobs/:id` to display progress.

## Data Extraction Strategy (Apple Notes)

- Source: Apple Notes local data on macOS.
- Approach options (choose one implementation first; keep interface pluggable):
  - AppleScript automation via `osascript` to enumerate notes and fetch HTML/plain text + attachments.
  - Python + `pyobjc` bridge to Notes if feasible.
  - Export-driven fallback: user triggers export; CLI reads the exported bundle (`.note`/`.notesarchive`) and converts.
- Conversion:
  - HTML/RTF → markdown (preserve lists, links, line breaks; serialize tables to markdown; include image references as relative paths).
  - Extract attachments to a local temp directory with deterministic relative paths.

## Canonical Hashing & Idempotency

- Canonical content hash (`contentHash`) computed from:
  - Normalized markdown body.
  - Sorted list of attachment descriptors `{ filename, bytes, sha256 }`.
  - JSON encode the canonical input and compute SHA-256.
- Use `appleNoteId` (if available) as a stable key for local caching.
- Idempotency behavior:
  - If a note’s current canonical hash matches the last uploaded hash, skip including it in the batch.
  - The server independently dedupes by `contentHash` (v1 acceptance assumes this works).

## Local State & Caching

- Local cache directory: `~/.visual-notes/` (configurable via env/flag).
  - `state.json`: map `{ appleNoteId: lastUploadedContentHash, lastEditedTimestamp }`.
  - `attachments/` (temp): extracted files for the current batch (cleaned after upload).
- The cache allows the CLI to quickly determine new/changed notes and cap to the 100 most recently edited.

## Batch Selection

- Default: select up to 100 most-recently-edited notes.
- Exclude items whose `contentHash` matches local cache.
- Flags to override selection window:
  - `--limit N` (default 100).
  - `--since ISO_TIMESTAMP` to include notes edited after a timestamp.
  - `--all` (future; not in v1 acceptance; keep hidden or warn due to size limits).

## Manifest Format (mirrors server contract)

The CLI constructs `manifest.json` alongside attachment files:

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

- Attachments are referenced by `relPath` relative to the multipart root.
- For small attachments (optional), the CLI may inline as base64 JSON when below a threshold; default to file uploads for simplicity.

## Server Interactions (mirrors API)

- `POST /api/ingest/notes` (required)

  - Auth: `Authorization: Bearer <token>`.
  - Body: multipart form containing `manifest.json` and files at declared `relPath`s.
  - Response: `{ jobId, createdNoteVersionIds: string[], updatedNoteVersionIds: string[] }`.

- `GET /api/jobs/:id` (optional)

  - Used to poll progress for the ingest-triggered job (and subsequent `chunk`/`embed` jobs if the server chains them).
  - Display `{ status, progress, error?, recent logs }`.

- Optional future endpoints (not required for v1 CLI):
  - `POST /api/umap/runs` to trigger UMAP after large ingests.
  - `POST /api/export` to export selected ids (server-driven; better from the UI).

## Limits & Enforcement (client-side guards)

- Request size ≤ 100 MB; item size ≤ 10 MB; exclude audio/video attachments.
- Enforce before upload:
  - Per-attachment size check.
  - Aggregate request size estimation (manifest + files). If exceeded, split into multiple requests (v1 can warn and abort; splitting is a stretch goal).
  - Attachment MIME allowlist.

## Error Handling & Retries

- Retry policy for network/5xx with exponential backoff and jitter (max attempts configurable; default 3–5).
- 401/403: fail with clear guidance to set the bearer token.
- 413: fail with size diagnostics and per-item sizes to help the user shrink selection.
- 429: backoff respecting `Retry-After` if present.
- Partial failures: the server is idempotent; safe to retry the same manifest.

## CLI Commands (v1)

- `vn ingest` (primary)

  - Collects recently edited Apple Notes.
  - Converts to markdown + extracts attachments.
  - Computes canonical hashes and filters unchanged.
  - Creates manifest and uploads to server.
  - Prints summary and optional job id; can block until completion with `--wait`.

- `vn jobs status <jobId>` (optional convenience)
  - Polls `GET /api/jobs/:id` and prints status/logs.

Examples:

```bash
# Upload up to 100 most-recently-edited notes
vn ingest --server https://visual-notes.local --token env:VIS_NOTES_TOKEN

# Limit to 20 and wait for server-side processing to finish
vn ingest --limit 20 --wait --poll-interval 2s

# Check job status later
vn jobs status 2f8a3d2a-...-9c1c
```

## Configuration

- Resolution order (lowest to highest precedence):

  1. Default values.
  2. Config file: `~/.visual-notes/cli.toml`.
  3. Environment variables: `VIS_NOTES_SERVER`, `VIS_NOTES_TOKEN`, `VIS_NOTES_CACHE_DIR`.
  4. Command-line flags.

- Required settings:

  - `server` (e.g., `https://visual-notes.local`).
  - `token` (bearer token for server).

- Example `cli.toml`:

```toml
server = "https://visual-notes.local"
token = "env:VIS_NOTES_TOKEN"  # read token from environment
cache_dir = "~/.visual-notes"
request_size_mb = 100
item_size_mb = 10
```

## Logging & Diagnostics

- Human-readable logs by default; `--json` for structured JSON output suitable for automation.
- Verbosity flags: `-v`/`-vv` for more detail (e.g., per-note decisions, size calculations).
- Redact secrets (never print bearer token). Allow `--token-file` to read token from a file with strict perms.

## Security Considerations

- Store no secrets in plaintext config by default; prefer env variable indirection.
- Ensure temp files and cache directories have restricted permissions.
- Do not upload audio/video; do not attempt to read protected system locations.

## Implementation Notes (Python)

- Packaging: simple `pipx`-installable tool; entrypoint `vn` or `visual-notes`.
- Dependencies:
  - Markdown conversion (e.g., `beautifulsoup4` + custom rules or `html2text` with tuning).
  - HTTP client (e.g., `httpx` with timeouts and retries).
  - Hashing (`hashlib`), MIME sniffing (`python-magic` optional), TOML (`tomli`/`tomllib`).
  - Apple Notes extraction layer (AppleScript via `subprocess` initially).
- Structure:
  - `extract/` for Apple Notes adapters.
  - `convert/` for HTML→markdown and attachment handling.
  - `cli/` commands (`ingest`, `jobs`).
  - `state/` for cache management.

## Acceptance Criteria (CLI)

- On a typical corpus, the CLI selects ≤100 recent notes, skips unchanged, and uploads within size limits.
- Manifest matches the server contract; attachments resolve via `relPath`.
- Retries/backoff behave correctly on transient failures; clear errors on auth/size violations.
- Output shows counts for created/updated/unchanged and the `jobId` returned by the server.

## Future Work

- Native Apple Notes API integration via `pyobjc` for richer metadata and robustness.
- Smarter batch splitting when aggregate size exceeds 100 MB.
- Optional commands to trigger UMAP runs and exports after ingest.
- Windows/Linux support using exported data imports.
- Automated tests using a synthetic notes corpus.

## Next Steps

1. Spike AppleScript-based extractor to enumerate notes and pull HTML + attachments.
2. Implement HTML→markdown converter preserving lists/links/tables; attachment extraction with stable `relPath`s.
3. Implement canonical hashing and local cache (`state.json`).
4. Build `vn ingest` command with multipart upload to `POST /api/ingest/notes` + auth.
5. Add `--wait` and `vn jobs status` for progress via `GET /api/jobs/:id`.
6. Add size guards and MIME allowlist; surface clear errors.
7. Package for `pipx` and document configuration, examples, and troubleshooting.
