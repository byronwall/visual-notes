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
- Implement the chunking strategy for longer notes - split into chunks, embed each chunk, and pool/aggregate the embeddings for the note.
  - Provide a way to see the chunk embeddings somewhere
  - Make sure chunks are linked back to the note - will use for search at some point too.
- Will do UMAP on the note embedding (single)

### Future ideas - don't do them

- Might be nice to also allow plotting the chunks on the canvas (or run the chunk embeddings through UMAP - and show relative to the whole)

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
