# How to improve the embeddings

## What to do first

- Implement the feature flags below - implement them as parameters in an embedding run - give toggles in the UI and store so they can be viewed in the embeddings run page.
  - PREPROCESS_STRIP_DATA_URIS
  - PREPROCESS_MARKDOWN_TO_PLAIN
  - PREPROCESS_STRIP_BARE_URLS
  - PREPROCESS_CODEBLOCK_POLICY
  - PREPROCESS_NORMALIZE_WHITESPACE
  - PREPROCESS_KEEP_OUTLINE
  - CHUNKER_MODE
  - CHUNK_MIN_MAX_TOKENS
  - CHUNK_SKIP_SMALL
  - CHUNK_DEDUP_NEAR_DUPES
  - AGGREGATION_STRATEGY
  - AGG_WEIGHT_BOOST_TITLE
  - AGG_NORM_L2
  - MODEL_CHOICE
  - BATCH_POLICY
  - RETRY_BACKOFF
  - CACHE_BY_CONTENT_HASH
  -

## Chat session

Hi,

> Short + actionable: turn each item on/off and measure impact on recall@K and cluster purity.

### Feature flags to add (toggle + A/B)

- **`PREPROCESS_STRIP_DATA_URIS`**

  - Replace `![alt](data:...)` and `<img src="data:...">` with `[image: alt]`.
  - Why: kills token bloat; keeps human meaning (alt/caption).

- **`PREPROCESS_MARKDOWN_TO_PLAIN`**

  - Convert MD → clean text (keep headings/bullets/link-text + hostname).
  - Why: models see prose, not punctuation scaffolding.

- **`PREPROCESS_STRIP_BARE_URLS`**

  - Drop naked `http(s)://…` strings; keep anchor text/domains only.
  - Why: avoid noise tokens.

- **`PREPROCESS_CODEBLOCK_POLICY`** = `"stub" | "keep-first-20-lines" | "full"`

  - Default `"stub"` → `[code block: ts]`.
  - Why: code walls drown semantics unless your workflow queries code.

- **`PREPROCESS_NORMALIZE_WHITESPACE`**

  - Collapse runs, trim, unify bullet symbols.

- **`PREPROCESS_KEEP_OUTLINE`**

  - Prepend `H1→H3` path to each section chunk.
  - Why: strengthens topic signal per chunk.

- **`CHUNKER_MODE`** = `"structure"` (default) | `"sliding"`

  - `"structure"`: split by headings/paragraphs; merge to 100–400 tokens.
  - `"sliding"`: 256–512 token windows with 32–64 token overlap.
  - Why: both beat naive truncation; compare purity/recall.

- **`CHUNK_MIN_MAX_TOKENS`**

  - e.g., `min=100`, `max=400` (structure) or `size=384`, `overlap=48` (sliding).

- **`CHUNK_SKIP_SMALL`**

  - Drop < ~30 tokens unless it’s a title/heading.

- **`CHUNK_DEDUP_NEAR_DUPES`**

  - Local sim hash / cosine > 0.98 within note → keep one.

- **`AGGREGATION_STRATEGY`** = `"mean"` (baseline) | `"weighted-mean"` | `"SIF"` | `"topk-centroid"`

  - `"weighted-mean"`: weight = `log1p(tokens)`.
  - `"SIF"`: weight by smoothed inv frequency (needs global term stats).
  - `"topk-centroid"`: k-means over chunks in-note; use largest cluster centroid.

- **`AGG_WEIGHT_BOOST_TITLE`**

  - Multiply weight for title/first chunk (e.g., ×1.5).

- **`AGG_NORM_L2`**

  - L2-normalize chunk vectors before pooling.

- **`MODEL_CHOICE`**

  - `"text-embedding-3-large"` vs `"3-small"`; record dims from API, don’t infer.

- **`BATCH_POLICY`**

  - Token-aware batching (target ≤ 20–40k tokens/request).

- **`RETRY_BACKOFF`**

  - 429/5xx retries with exp backoff + jitter, idempotency key per batch.

- **`CACHE_BY_CONTENT_HASH`**

  - Skip re-embedding when `(model, content_hash)` already exists.

- **`LOG_TOKEN_USAGE`**

  - Persist `prompt_tokens` per chunk and per-note aggregate.

- **`STORE_SECTION_EMBEDDINGS`**

  - Save chunk vectors for recall/explainability; not just note-level.

- **`STORE_NOTE_EMBEDDING`**

  - Save pooled “single/best” vector per note (for UMAP/clustering).

- **`PGVECTOR_COLUMN`**

  - Store as `vector(d)` not `float[]`; add ivfflat/hnsw index.

- **`RETRIEVAL_HYBRID`**

  - BM25/`pg_trgm` first-pass → vector re-rank.

- **`RETRIEVAL_RERANK_L2`**

  - L2-normalize vectors before cosine for consistency.

- **`UMAP_SETTINGS`**

  - Normalize vectors, `n_neighbors=10–25`, `min_dist=0.1–0.3`; log run params.

- **`CLUSTERER`** = `"HDBSCAN" | "kmeans"`

  - Prefer HDBSCAN for variable-density notes; log noise rate.

- **`OCR_IMAGE_TEXT`**

  - Optional OCR for screenshots → append under `[image text]` section with low weight.

- **`MULTIMODAL_SIDECHANNEL`**

  - Separate CLIP/multimodal embeddings for images; **do not** feed base64 to text model; store parallel vectors.

- **`EVAL_HARNESS`**

  - Track offline metrics: recall@10 on known-related note pairs, NMI/ARI for tag clusters; switch flags → compare.

---

### Prisma schema: chunked + pooled embeddings (pgvector-ready)

> Keeps your existing models; adds section-level storage, hashing, and proper uniqueness. Use `Float[]` if you must, but I recommend `pgvector` with the SQL below.

```prisma
// prisma/schema.prisma (excerpt – new/changed parts only)

model Doc {
  id         String   @id @default(cuid())
  title      String
  markdown   String   // @db.Text
  html       String   // @db.Text
  contentHash String? @index // normalized, full-note hash (plain-text after preprocess)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sections   DocSection[]
  embeddings DocEmbedding[]
}

model DocSection {
  id          String   @id @default(cuid())
  docId       String
  // Structural address for explainability/debug (e.g., ["Work","Roadmap","Q4"])
  headingPath String[] @default([])
  // Cleaned plain text for this chunk (post-preprocess)
  text        String   // @db.Text
  contentHash String   // sha256 of text; enables dedupe between runs
  orderIndex  Int      // chunk order within doc (for sliding windows)
  charCount   Int
  tokenCount  Int?

  doc         Doc      @relation(fields: [docId], references: [id], onDelete: Cascade)

  @@unique([docId, contentHash]) // same chunk content once per doc
  @@index([docId, orderIndex])
}

model EmbeddingRun {
  id        String   @id @default(cuid())
  model     String
  dims      Int
  params    Json?
  createdAt DateTime @default(now())

  docEmbeddings        DocEmbedding[]
  docSectionEmbeddings DocSectionEmbedding[]
  UmapRun              UmapRun[]
}

model DocSectionEmbedding {
  id           String   @id @default(cuid())
  runId        String
  docId        String
  sectionId    String
  // Store as Float[] or switch to pgvector via SQL migration
  vector       Float[]
  // Diagnostics
  tokenCount   Int?
  createdAt    DateTime @default(now())

  run          EmbeddingRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  doc          Doc          @relation(fields: [docId], references: [id], onDelete: Cascade)
  section      DocSection   @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  @@unique([runId, sectionId])
  @@index([docId])
}

model DocEmbedding {
  id           String   @id @default(cuid())
  runId        String
  docId        String
  // Pooled "single/best" embedding for the note
  vector       Float[]
  contentHash  String    // hash of whole-note normalized text used to compute it
  // Diagnostics
  sectionCount Int
  tokenCount   Int?      // sum of section tokens
  createdAt    DateTime  @default(now())

  run          EmbeddingRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  doc          Doc          @relation(fields: [docId], references: [id], onDelete: Cascade)

  @@unique([runId, docId])
  @@index([docId])
  @@index([contentHash]) // enables skip-by-hash for same model/run params
}

model UmapRun {
  id             String   @id @default(cuid())
  embeddingRunId String
  dims           Int
  params         Json?
  createdAt      DateTime @default(now())

  embeddingRun EmbeddingRun @relation(fields: [embeddingRunId], references: [id], onDelete: Cascade)
  points       UmapPoint[]

  @@index([embeddingRunId, createdAt])
}

model UmapPoint {
  id    String @id @default(cuid())
  runId String
  docId String
  x     Float
  y     Float
  z     Float?

  run UmapRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, docId])
  @@index([docId])
}
```

> **Optional pgvector migration (recommended)**
> Convert `Float[]` to `vector(d)` for fast ANN:

```sql
-- 1) Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Convert columns (adjust table/column names as deployed)
-- Example for 1536-dim small model (store dim per run if you vary)
ALTER TABLE "DocSectionEmbedding"
  ALTER COLUMN "vector" TYPE vector(1536) USING "vector"::vector;

ALTER TABLE "DocEmbedding"
  ALTER COLUMN "vector" TYPE vector(1536) USING "vector"::vector;

-- 3) Add ANN indexes (choose one)
-- IVFFlat (needs ANALYZE; good for many queries)
CREATE INDEX "docsec_vec_ivf" ON "DocSectionEmbedding" USING ivfflat ("vector") WITH (lists = 100);
CREATE INDEX "doc_vec_ivf"    ON "DocEmbedding"        USING ivfflat ("vector") WITH (lists = 100);

-- or HNSW (Postgres ≥16 + pgvector ≥0.6)
-- CREATE INDEX "doc_vec_hnsw" ON "DocEmbedding" USING hnsw ("vector");
```

---

### How to evaluate changes (fast loop)

- Build a small gold set of **related note pairs** (5–10 groups of 5–20 notes).
- For each flag combo:

  - Compute **recall@10** per query note and average.
  - Cluster note vectors; compute **NMI/ARI** vs. your tags/folders.
  - Log **cost/time** and **avg tokens/note**.

- Keep a CSV of results; promote a flag when it’s a net win on quality/cost.

If you want, I can wire these flags into your current route (behind `serverEnv` or DB-stored configs) and add token-aware batching + retry scaffolding.
