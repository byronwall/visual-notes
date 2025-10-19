## Visual Notes CLI – Apple Notes Export

This CLI exports Apple Notes quickly and reliably with per-file HTML as the default. It also supports inline HTML in JSON on demand, filtering by modification time, Markdown conversion, and posting Markdown to the Visual Notes server.

### Requirements

- macOS with Notes.app
- Allow the script access to Notes when prompted (Automation/Accessibility). You may need to re-run after granting permissions.

### Quick start

- Compile once (recommended):

```bash
osacompile -l JavaScript -o scripts/export-apple-notes.scpt scripts/export-apple-notes.jxa
```

- Run (compiled):

```bash
osascript scripts/export-apple-notes.scpt
```

- Or run the source directly:

```bash
osascript -l JavaScript scripts/export-apple-notes.jxa
```

### Default behavior

- **Per-file HTML by default**:
  - If `HTML_OUT_DIR` is unset and `INLINE_HTML` is not set → writes to `./notes_html` (relative to current working directory).
  - If `HTML_OUT_DIR` is set → writes there.
- **Inline HTML in JSON only when `INLINE_HTML=1`.**
- **Performance**:
  - Vectorized metadata fetch (fewer AppleEvents)
  - Deferred `body()` fetch until needed
  - Sorted by updated desc (modified or created)
  - `LIMIT` and `SINCE_EPOCH_SEC` supported
  - Skips writing files that already exist

### Environment variables (JXA exporter)

- `LIMIT=100` – maximum notes to export (default 10)
- `HTML_OUT_DIR=/abs/path/dir` – output directory for per-file HTML
- `SINCE_EPOCH_SEC=1697000000` – include only notes modified since this epoch (seconds)
- `INLINE_HTML=1` – return inline HTML in JSON instead of writing files

### CLI wrapper (Node)

The Node CLI orchestrates the JXA exporter, writes an index, optionally converts to Markdown, and can POST Markdown to the app server.

Run from this package directory:

- TypeScript (dev):

```bash
pnpm tsx src/index.ts [flags]
```

- Node (built):

```bash
node dist/index.js [flags]
```

Supported flags:

- `--limit N` or `-n N` – limit exported notes (default 10)
- `--jxa-raw-dir /abs/path` – output directory for JXA per-file HTML (overrides default)
- `--inline-json` – force inline JSON from JXA (sets `INLINE_HTML=1`)
- `--since EPOCH_SECONDS` or `--since-epoch EPOCH_SECONDS` – filter by modification time
- `--markdown` – convert HTML to Markdown and write `out/notes.json`
- `--split` – when `--markdown` is on, also write individual `*.md` files
- `--split-dir /abs/or/relative` – directory for Markdown split output
- `--post` – POST each Markdown note to the server (`/api/docs`)
- `--server-url URL` – base server URL (default `http://localhost:3000`); can also set `SERVER_URL`
- `--verbose` or `-v` – verbose logging
- `--allow-dummy` – if JXA fails (permissions), use a deterministic sample to verify pipeline

Outputs:

- Raw (default): `out/raw-index.json` with metadata and file paths
- JXA HTML files: `out/notes-html` by default, or as set via `--jxa-raw-dir`
  - Filenames: `<index>-<sanitizedId>-<updatedUTC>-<sanitizedTitle>.html` (e.g., `12-abc123-20250102T120000Z-weekly-planning.html`)
- Markdown (with `--markdown`): `out/notes.json` and optionally individual `*.md` files when `--split` is provided

### Typical runs

- Default per-file HTML under cwd (JXA directly):

```bash
osascript scripts/export-apple-notes.scpt
```

- Custom directory:

```bash
HTML_OUT_DIR="$PWD/out/notes" osascript scripts/export-apple-notes.scpt
```

- Inline JSON (no files):

```bash
INLINE_HTML=1 osascript scripts/export-apple-notes.scpt
```

- CLI wrapper, defaults (writes raw index + per-file HTML):

```bash
pnpm tsx src/index.ts --verbose
```

- CLI wrapper with inline JSON and since filter:

```bash
pnpm tsx src/index.ts --inline-json --since 1697000000 -n 200
```

- CLI wrapper with Markdown conversion and split files:

```bash
pnpm tsx src/index.ts --markdown --split --split-dir "$PWD/out/notes-md"
```

- End-to-end: convert to Markdown and upload to the running app server:

```bash
pnpm ingest -- --markdown --split --post --server-url http://localhost:3000 -v
```

Notes:

- The CLI prefers reading HTML from on-disk files via `filePath` when converting to Markdown; otherwise it falls back to inline `html` returned by JXA.
- The upload step posts `{ title, markdown }` to `POST /api/docs` on the base `--server-url`.
- A final summary prints success/failed counts; verbose mode logs each note’s action.

### JSON shape

The JXA exporter returns either an array of notes or an object with telemetry. The Node CLI normalizes this to an array internally.

Inline JSON (when `INLINE_HTML=1`):

```json
{
  "notes": [
    {
      "id": "...",
      "title": "...",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-02T12:00:00.000Z",
      "folder": "...",
      "html": "<p>...</p>"
    }
  ],
  "wrote": 10,
  "skipped": 0,
  "outDir": null,
  "inline": true
}
```

Per-file HTML (default):

```json
{
  "notes": [
    {
      "id": "...",
      "title": "...",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-02T12:00:00.000Z",
      "folder": "...",
      "filePath": "/abs/path/notes_html/<id>-<title>.html"
    }
  ],
  "wrote": 9,
  "skipped": 1,
  "outDir": "/abs/path/notes_html",
  "inline": false
}
```

### Notes on performance and reliability

- Metadata fields (`id`, `name`, `creationDate`, `modificationDate`) are fetched in a vectorized way to reduce AppleEvents.
- HTML `body()` is only fetched when needed (when writing a file or in inline mode).
- Notes are sorted by `updatedAt` desc (using `modificationDate || creationDate`).
- Existing files are skipped for resumability.

### Troubleshooting

- If you see a permissions error from `osascript`, open a note in Notes.app and re-run so macOS can prompt for permissions. You may need to grant Automation/Accessibility in System Settings → Privacy & Security.
- Use `--allow-dummy` to validate the Node pipeline without Notes permissions.
- Prefer absolute paths for `--jxa-raw-dir` and `--split-dir`.
