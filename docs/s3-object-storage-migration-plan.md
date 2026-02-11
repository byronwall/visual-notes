# S3 Object Storage Migration Plan (Post On-Disk Prototype)

## Goals

- Replace local `/app/data/doc-images` serving with S3-compatible object storage.
- Keep the current app behavior stable during migration.
- Preserve recoverability (existing DB backups + reversible URL strategy).
- Add a local-dev object storage service in Docker Compose that is **not MinIO**.

## Recommendation

Use **SeaweedFS S3 gateway** for local/dev in Docker Compose.

Why:

- S3-compatible API.
- Lighter setup than Ceph/RGW.
- Single stack can run in compose (master + volume + filer + s3).
- Avoids MinIO-specific integration issues you’ve hit elsewhere.

## Target End State

- New image uploads are written directly to object storage.
- Notes reference stable object URLs (or app-routed proxy URLs).
- Existing `/api/doc-images/*` can remain as compatibility layer for old links.
- Old local files are backfilled to object storage, then optionally cleaned up.

## Phase 0: Prep and Decisions

1. Decide URL strategy:
   - Option A: Store direct object URL in note HTML/markdown.
   - Option B: Store object key in DB and serve through app route (`/api/doc-images/:id`) that streams from S3.
2. Decide bucket naming:
   - Example: `visual-notes-images`.
3. Decide object key format:
   - Keep content-hash based names (already in place) for dedupe.

Recommended:

- Use **Option B** initially (proxy route in app) for easier provider swaps and auth/control.
- Keep key pattern: `doc-images/<sha256>.<ext>`.

## Phase 1: Docker Compose (Dev) with SeaweedFS

Add services to `app/docker-compose.yml`:

- `seaweed-master`
- `seaweed-volume`
- `seaweed-filer`
- `seaweed-s3`

Persist volume data with named volumes.

Expose S3 endpoint in compose network (for app container), e.g.:

- Internal endpoint: `http://seaweed-s3:8333`
- Optional host port for debugging: `8333:8333`

Environment/config to add for app:

- `OBJECT_STORAGE_PROVIDER=s3`
- `S3_ENDPOINT=http://seaweed-s3:8333`
- `S3_REGION=us-east-1`
- `S3_BUCKET=visual-notes-images`
- `S3_ACCESS_KEY_ID=...`
- `S3_SECRET_ACCESS_KEY=...`
- `S3_FORCE_PATH_STYLE=true` (important for many local S3 emulators)

## Phase 2: App Storage Abstraction

Introduce a storage interface in server code:

- `putObject(key, bytes, contentType)`
- `getObjectStream(key)`
- `headObject(key)`
- `deleteObject(key)` (optional)
- `getPublicUrl(key)` (optional)

Implementations:

1. `DiskObjectStore` (current local storage; keep as fallback)
2. `S3ObjectStore` (new)

Selection:

- Use env var switch (`OBJECT_STORAGE_PROVIDER`).

## Phase 3: Data Model Additions

Add DB fields on `Doc` (or a related image table) to track migrated object references and provenance.

Minimal approach:

- Keep content URL rewrite strategy (as now), no new relational table required.
- Continue using `inlineImageMigrationBackup` for rollback.

Better long-term approach:

- Add `DocImage` table:
  - `id`
  - `docId`
  - `originalUrl` (data URL or old local URL)
  - `storageKey`
  - `contentType`
  - `sizeBytes`
  - `createdAt`

This improves observability and future maintenance.

## Phase 4: Write Path Migration

Update migration/admin actions so when persisting images:

1. Decode data URL.
2. Transcode HEIC to JPEG when needed (already implemented for disk flow).
3. Write bytes to S3 with correct `Content-Type`.
4. Rewrite note content URL to canonical app URL (or direct S3 URL).
5. Save backup content before first rewrite (already implemented).

## Phase 5: Read Path Compatibility

Update `/api/doc-images/[name]` route to:

1. Check S3/object storage first.
2. Fallback to disk for legacy files.
3. Keep HEIC compatibility fallback (serve JPEG where available).

This allows zero-downtime transition for existing notes.

## Phase 6: Backfill Existing Disk Files

Add admin action + page controls:

1. Enumerate local files under `/app/data/doc-images`.
2. Upload missing objects to S3.
3. Verify uploaded object metadata (`Content-Type`, size).
4. Report progress and failures in admin UI.

Optional:

- Rewrite old URLs to new canonical format only after verification.

## Phase 7: Verification and Rollout

Validation checklist:

1. New uploads route to S3 in dev and prod.
2. Existing note images render via compatibility route.
3. HEIC-origin images render as JPEG in major browsers.
4. Admin migration metrics show no remaining inline data URLs.
5. Random sample restore test from `inlineImageMigrationBackup` works.

## Phase 8: Cleanup

After confidence window:

1. Mark disk fallback as deprecated.
2. Stop writing new files to disk.
3. Optionally archive/remove old disk files.
4. Keep backup column for one release cycle, then decide retention policy.

## Rollback Strategy

If S3 integration fails:

1. Switch `OBJECT_STORAGE_PROVIDER=disk`.
2. Keep serving via `/api/doc-images`.
3. Recover affected notes from `inlineImageMigrationBackup` if needed.

Because URLs remain app-controlled (recommended Option B), rollback is config-first.

## Suggested Implementation Order (Short)

1. Add SeaweedFS services + app env vars in compose.
2. Build `S3ObjectStore` + provider switch.
3. Update `/api/doc-images` to read S3 then disk fallback.
4. Add admin “Backfill Disk -> S3” batch.
5. Switch migration writes to S3.
6. Run staged migration and verify.

## Notes on Production Providers

For real deployment, this same interface works with:

- Cloudflare R2
- Backblaze B2 S3 API
- AWS S3
- Wasabi

Only endpoint/credentials config should change.

## Additional Docker S3 Options (Non-MinIO)

These are additional drop-in options you can run on the same machine as app + db via Docker Compose.

Research notes:

- Garage docs + Docker example: [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
- Zenko CloudServer Docker docs: [CloudServer Docker](https://s3-server.readthedocs.io/en/latest/DOCKER.html)
- Adobe S3Mock Docker compose docs: [S3Mock README](https://github.com/adobe/S3Mock)
- S3Proxy Docker image docs: [andrewgaul/s3proxy](https://hub.docker.com/r/andrewgaul/s3proxy/)

### 1) Garage (Deuxfleurs)

Good fit if you want a real object store (not just a mock), lightweight, and fully self-hostable.

Compose additions (simple single-node):

```yaml
services:
  garage:
    image: dxflrs/garage:v2.2.0
    restart: unless-stopped
    ports:
      - "3900:3900" # S3 API
      - "3901:3901" # RPC
      - "3902:3902" # Web
      - "3903:3903" # Admin
    volumes:
      - ./garage.toml:/etc/garage.toml
      - garage-meta:/var/lib/garage/meta
      - garage-data:/var/lib/garage/data

  app:
    environment:
      OBJECT_STORAGE_PROVIDER: s3
      S3_ENDPOINT: http://garage:3900
      S3_REGION: garage
      S3_BUCKET: visual-notes-images
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID}
      S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY}

volumes:
  garage-meta:
  garage-data:
```

Notes:

- Garage needs one-time bootstrap commands to create key/bucket (`garage key create`, `garage bucket create`, and allow bindings).

### 2) Zenko CloudServer (Scality)

Useful when you want a straightforward S3-compatible server with file backend and persistent volumes.

Compose additions:

```yaml
services:
  cloudserver:
    image: zenko/cloudserver:latest
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      REMOTE_MANAGEMENT_DISABLE: "1"
      SCALITY_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:-accessKey1}
      SCALITY_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:-verySecretKey1}
    volumes:
      - cloudserver-data:/usr/src/app/localData
      - cloudserver-metadata:/usr/src/app/localMetadata

  app:
    environment:
      OBJECT_STORAGE_PROVIDER: s3
      S3_ENDPOINT: http://cloudserver:8000
      S3_REGION: us-east-1
      S3_BUCKET: visual-notes-images
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:-accessKey1}
      S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:-verySecretKey1}

volumes:
  cloudserver-data:
  cloudserver-metadata:
```

### 3) Adobe S3Mock (Dev/Test focused)

Very easy for local integration testing. Not for production object storage.

Compose additions:

```yaml
services:
  s3mock:
    image: adobe/s3mock:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    environment:
      COM_ADOBE_TESTING_S3MOCK_STORE_RETAIN_FILES_ON_EXIT: "true"
      COM_ADOBE_TESTING_S3MOCK_STORE_ROOT: /containers3root
      COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS: visual-notes-images
    volumes:
      - s3mock-data:/containers3root

  app:
    environment:
      OBJECT_STORAGE_PROVIDER: s3
      S3_ENDPOINT: http://s3mock:9090
      S3_REGION: us-east-1
      S3_BUCKET: visual-notes-images
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: test
      S3_SECRET_ACCESS_KEY: test

volumes:
  s3mock-data:
```

### 4) S3Proxy (Filesystem backend)

Simple S3 front-end backed by local filesystem (or other jclouds providers). Good transitional option.

Compose additions:

```yaml
services:
  s3proxy:
    image: andrewgaul/s3proxy:latest
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      S3PROXY_AUTHORIZATION: aws-v2-or-v4
      JCLOUDS_PROVIDER: filesystem
      JCLOUDS_FILESYSTEM_BASEDIR: /data
      S3PROXY_IDENTITY: ${S3_ACCESS_KEY_ID:-remote-identity}
      S3PROXY_CREDENTIAL: ${S3_SECRET_ACCESS_KEY:-remote-credential}
    volumes:
      - s3proxy-data:/data

  app:
    environment:
      OBJECT_STORAGE_PROVIDER: s3
      S3_ENDPOINT: http://s3proxy:80
      S3_REGION: us-east-1
      S3_BUCKET: visual-notes-images
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:-remote-identity}
      S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:-remote-credential}

volumes:
  s3proxy-data:
```

## Practical recommendation from these options

If you want the best “real object storage” local experience without MinIO, choose:

1. **Garage** first
2. **SeaweedFS** second

If you mainly need local API emulation for tests/CI, choose:

1. **S3Mock**
2. **LocalStack** (note: S3-only image docs explicitly call out persistence limitations)

## Simplest Possible SeaweedFS Compose (All-In-One)

If you want the absolute simplest local drop-in (single container), use SeaweedFS in all-in-one mode with S3 enabled:

```yaml
services:
  seaweed:
    image: chrislusf/seaweedfs:3.75
    restart: unless-stopped
    command:
      [
        "server",
        "-s3",
        "-s3.config=/etc/seaweedfs/s3.conf",
        "-dir=/data",
        "-ip=seaweed"
      ]
    ports:
      - "8333:8333" # S3 API
      - "9333:9333" # Master/Filer UI
    volumes:
      - seaweed-data:/data
      - ./seaweed-s3.conf:/etc/seaweedfs/s3.conf:ro

  app:
    environment:
      OBJECT_STORAGE_PROVIDER: s3
      S3_ENDPOINT: http://seaweed:8333
      S3_REGION: us-east-1
      S3_BUCKET: visual-notes-images
      S3_FORCE_PATH_STYLE: "true"
      S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID}
      S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY}

volumes:
  seaweed-data:
```

Example minimal `seaweed-s3.conf`:

```json
{
  "identities": [
    {
      "name": "visual-notes",
      "credentials": [
        {
          "accessKey": "your-access-key",
          "secretKey": "your-secret-key"
        }
      ],
      "actions": [
        "Admin",
        "Read",
        "Write",
        "List",
        "Tagging"
      ]
    }
  ]
}
```

This mode is ideal for fast local development. For better isolation and scale behavior, use the multi-service SeaweedFS layout described earlier.
