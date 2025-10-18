# Product Requirements Document (Final)

## 1) Goal & Scope

- **Goal:** Private, single-user system that incrementally ingests Apple Notes, preserves structure and attachments, chunks + embeds, projects with UMAP, and explores notes on an infinite canvas with simple AI actions and provenance.
- **In-scope (v1)**

  - Python CLI → Apple Notes → server ingestion (incremental in batches of 100 most-recently-edited).
  - Markdown conversion preserving lists/links; images & most attachments; exclude audio/video.
  - Chunking with configurable runs; embeddings for full notes and chunks; pgvector search.
  - Manually triggered UMAP runs (2D & 3D) with run history.
  - Infinite canvas: pan/zoom, hover, click-to-open side panel, lasso select, Voronoi overlays.
  - Hybrid search (keyword + semantic) that filters the canvas.
  - AI actions on selection (summarize, compare/contrast, extract tasks, tags, merge → **new notes**) with **provenance links**.
  - Jobs/progress/logs; export up to 100 items as ZIP or copy markdown.

- **Non-goals (v1)**

  - Two-way sync, deletion propagation, multi-user/sharing, client-side UMAP, facets/recolor rules, OCR for PDFs, resume-from-checkpoint jobs.

---

## 2) Top User Flows

- **Incremental ingest**

  - Run CLI → fetch 100 most-recently-edited notes → exclude already-known → upload within limits → UI shows job progress → notes appear on canvas after chunking/embedding; user can later trigger UMAP.

- **Explore & read**

  - Search → canvas filters → pan/zoom → click opens note in collapsible side panel (full note; optional chunk boundary overlay for diagnostics).

- **Synthesize with AI**

  - Lasso ≤ any size, but AI actions **constrain to ≤10 notes or ~10k tokens** → action produces a **new note** → provenance links back to sources.

- **Re-layout**

  - After bigger ingests, user **manually triggers UMAP** (2D and/or 3D) → switch between runs to compare layouts.

- **Export**

  - Select up to 100 notes → export ZIP (markdown + attachments) or copy markdown.

---

## 3) Content, Attachments, Hashing

- **Markdown fidelity**

  - Preserve lists, links, line breaks, and basic structure; keep “markdown-ish” where Apple Notes has no perfect equivalent.
  - **Images & sketches:** represented in markdown with **relative paths** emitted by the CLI; server rewrites/render paths on display.
  - **Tables:** serialize to markdown table text for display and **for hashing**.

- **Attachments**

  - Ingest all attachment types **except audio/video**; store as files; record MIME/size/hash.

- **Content hashing (canonical)**

  - Inputs: normalized markdown body + sorted list of attachment descriptors (`filename`, byte length, SHA-256) → JSON → SHA-256.
  - **De-dup/versioning:** if `contentHash` exists, skip; if differs, create a new `NoteVersion` (no merge in v1).
  - Include `appleNoteId` and local timestamps when available for reference.

---

## 4) Chunking, Embeddings, UMAP

- **Chunking**

  - Strategy: semantic boundaries (headings/paragraphs/lists) with **max token cap**; if cap exceeded, split near a reasonable boundary; **images may become standalone chunks**.
  - **ChunkingRun** captures params per note/version; multiple runs can coexist; flip/compare without recompute.

- **Embeddings**

  - Targets: **full NoteVersion** and **Chunk**; **exclude metadata** from embedding text.
  - Store vectors with **pgvector**; maintain **EmbeddingRun** keyed by model/config.

- **UMAP**

  - **Manual trigger** (primary). Optionally trigger after “large ingest”.
  - Produce **2D and 3D** projections; store as **UmapRun** with params and history.
  - Canvas pulls positions from a selected run; users can switch runs.

---

## 5) Canvas & Reader UX

- **Interactions**

  - Pan/zoom; hover preview (title + snippet); click → open full note in **collapsible side panel**.
  - **Lasso selection**; **Voronoi** overlays to visualize neighborhoods/groups.
  - Uniform dot size initially (defer color/size/shape encodings).

- **Search**

  - Single search box (hybrid keyword + semantic). Results **filter** the canvas; clearing search **reverts to full set**.

- **Diagnostics**

  - Optional toggle to visualize **chunk boundaries** inside the side panel for the current note.

---

## 6) AI Actions & Provenance

- **Actions**

  - Summarize, compare/contrast, extract tasks, generate tags, merge selection → **create a new Note** (default).
  - Edits to existing notes allowed but **original preserved** for restore.
  - **Limits:** process **≤10 notes or ~10k tokens** per action (first N chosen deterministically; surface a notice if over the cap).

- **Provenance**

  - Store **structured provenance** linking **generated NoteVersion** to each **source NoteVersion** with action type.
  - Side panel shows “Generated from …” with links; future graph features can build on this.

---

## 7) Jobs, Progress, Failure Model

- **Jobs**

  - `ingest`, `chunk`, `embed`, `umap` as distinct **Job** rows with progress (0..1), status, timestamps.
  - UI polling + job center with per-job logs.

- **Failure**

  - **No checkpoint resume** in v1; **restart from beginning**; idempotency via `contentHash` and “already processed” guards.

- **Logs**

  - Structured logs (level, message, optional jobId & data) for debugging and audit.

---

## 8) Data Model (conceptual)

- **Core**

  - `User`, `Note`, `NoteVersion`, `Attachment`
  - `ChunkingRun`, `Chunk`
  - `EmbeddingRun`, `Embedding` (pgvector)
  - `UmapRun`, `UmapPoint`
  - `Job`, `Log`

- **Provenance**

  - `NoteProvenance(id, generatedNoteVersionId FK, sourceNoteVersionId FK, action ENUM, createdAt)`

- **Versioning**

  - `Note.latestVersionId` points to current `NoteVersion`; old versions retained.

---

## 9) API (v1 surface)

| Method | Path                          | Purpose                                                                                                               |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/ingest/notes`           | Upload a batch of notes + attachments (enforces size limits). Returns created/updated `noteVersionIds` + queued jobs. |
| `GET`  | `/api/jobs/:id`               | Job status + progress + recent logs.                                                                                  |
| `GET`  | `/api/search?q=...&runId=...` | Hybrid search (keyword + semantic); returns ids + scores (optionally tied to an EmbeddingRun/UMAP run).               |
| `GET`  | `/api/umap/runs`              | List UMAP runs (params, dims, createdAt).                                                                             |
| `POST` | `/api/umap/runs`              | **Trigger new UMAP run** (body: embeddingRunId, dims, params).                                                        |
| `GET`  | `/api/umap/points?runId=...`  | Positions + minimal note metadata for canvas.                                                                         |
| `GET`  | `/api/notes/:id`              | Full note (+ latest version, attachments, provenance summary).                                                        |
| `POST` | `/api/ai/actions`             | Execute AI action on up to 10 notes / ~10k tokens; returns new note id(s).                                            |
| `POST` | `/api/export`                 | Export selected ids (≤100) as ZIP or return as text for copy.                                                         |

---

## 10) Limits & Policies

| Area             | Limit / Policy                                                   |
| ---------------- | ---------------------------------------------------------------- |
| Ingest selection | **100 most-recently-edited** notes per run; exclude known ones.  |
| Request size     | **≤100 MB** per request (aggregate).                             |
| Item size        | **≤10 MB** per text body or per attachment.                      |
| Attachments      | All except **audio/video**.                                      |
| AI action input  | **≤10 notes** or **~10k tokens**, whichever comes first.         |
| Export           | **≤100** items per export.                                       |
| Deletion         | No delete propagation from Apple Notes (stale content persists). |
| Jobs             | No resume; restart with idempotent guards.                       |

---

## 11) Search Behavior

- **Hybrid ranking**

  - Keyword BM25 (or Postgres full-text) combined with semantic similarity (pgvector); weights can be static in v1.
  - Returned set filters canvas; non-matches are hidden or strongly de-emphasized.

- **State**

  - Clearing the query **restores full canvas** for the active UMAP run.

---

## 12) Security & Access

- **Single user**

  - Private deployment; CLI uses a bearer token; server trusts requests with that token.
  - No sharing or public links in v1.

---

## 13) Performance Targets

- **Scale target:** up to **10k notes**, ~3–10 chunks/note (30k–100k vectors).
- **Canvas:** first render ≤ ~2s for 10k points (virtualized/canvas/WebGL), pan/zoom ≥ ~45 FPS on modern laptop.
- **Search → filter:** ≤ ~300 ms for ~500 matches using cached positions + client filtering.
- **Vector search:** pgvector with HNSW index tuned later **as needed** (assume OK for v1).

---

## 14) Acceptance Criteria

- CLI reliably ingests **only new** (not-yet-known) notes from the last 100 edited; respects size limits; retries and error reporting are clear.
- Server persists `Note`/`NoteVersion`/`Attachment`; dedupe by `contentHash`.
- On new versions, chunking + embeddings run; vectors available; at least one UMAP 2D run selectable; 3D also available.
- Canvas displays points from selected run; hover/click/side panel work; lasso & Voronoi function.
- AI actions enforce input caps, create **new notes**, and record **provenance**.
- Search filters canvas; clearing restores full set.
- Jobs show progress; failures restart cleanly; logs are visible.
- Export works for ≤100 items with markdown + attachments.

---

## 15) Risks & Mitigations

- **Eventual capture of all notes:** If >100 unique notes are edited between runs, some won’t be caught that run.

  - _Mitigation:_ user runs CLI frequently; optional CLI param to widen window later.

- **Clutter from stale notes:** Deleted Apple Notes persist.

  - _Mitigation:_ add “Archive/Hide” controls later; filter by recency in future.

- **Job restarts can be wasteful:** No checkpoints.

  - _Mitigation:_ leverage idempotent checks (hashes) to skip already processed units on restart.

- **Vector/UMAP throughput:** Heavy runs on big corpora.

  - _Mitigation:_ manual triggering, batch sizing, concurrency caps, progress UI.

---

## 16) Future Work

- Visual encodings (color/size/shape), legends; user-defined recolor presets.
- Faceted filtering (pinned, timestamps, attachment types), saved views.
- Client-side UMAP for subsets; interactive re-projection.
- Multi-user, per-user DBs or RLS; selective sharing.
- Merge strategies for changed notes; conflict resolution UX.
- OCR for PDFs; safe audio/video handling.
- Fuzzy de-dup (beyond strict `contentHash`).
- Enrichment for external URLs (titles/previews).
- Tagging/labeling and a link graph UI.
- Replay bootstrap from raw uploads.

---

## 17) Observations & Practical Notes

- **Markdown paths:** The CLI’s relative image references + server rewrite on display keeps ingestion simple and rendering robust.
- **Provenance first-class:** A table beats markdown backlinks for queryability and future graph features; still emit backlinks in generated note bodies if you want human-readable trails.
- **Manual UMAP control:** Keeps compute predictable; pairs well with “compare runs” UX to see structural changes.
- **Caps where it matters:** The action cap (10 notes / ~10k tokens) protects latency and cost without blocking exploratory selection.

If you’re good with this PRD, I can follow up with: ticket breakdown, minimal Prisma schema draft, endpoint contracts, and a CLI argument spec (flags + examples).
