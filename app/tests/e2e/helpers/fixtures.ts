import { expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { parseEnv } from "node:util";
import {
  parseManifest,
  recordFixture,
  type FixtureEntry,
} from "../../../scripts/audit-fixtures.ts";
import { auditDatabaseUrl } from "../../../scripts/audit-harness.ts";

// Fixtures are created through the app's own endpoints and recorded in the
// fixture manifest named by AUDIT_RUN_MANIFEST (written by `pnpm audit:harness
// --run-manifest`). `pnpm audit:fixtures cleanup` later deletes only those IDs.
// Without a run manifest (a plain local run) creation is logged, not recorded.

type RunManifestFacts = {
  owner: string;
  database: string;
  fixtureManifest: string | null;
};

const readRunManifest = (): RunManifestFacts | null => {
  const path = process.env.AUDIT_RUN_MANIFEST;
  if (!path) return null;
  const run = JSON.parse(readFileSync(path, "utf8")) as RunManifestFacts;
  if (!run.fixtureManifest) {
    throw new Error(
      "[e2e-fixtures] the run manifest has no fixture manifest; start the harness with --fixtures.",
    );
  }
  return run;
};

const sleepSync = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Parallel workers share one manifest file, so each write holds a directory lock.
const withManifestLock = (manifestPath: string, write: () => void) => {
  const lock = `${manifestPath}.lock`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`[e2e-fixtures] timed out waiting for ${lock}`);
      }
      sleepSync(20);
    }
  }
  try {
    write();
  } finally {
    rmdirSync(lock);
  }
};

const recordAuditFixture = (entry: FixtureEntry) => {
  const run = readRunManifest();
  if (!run) {
    console.info(
      `[e2e-fixtures] created ${entry.entityKind} ${entry.id} (no AUDIT_RUN_MANIFEST; not recorded)`,
    );
    return;
  }
  const manifestPath = run.fixtureManifest!;
  withManifestLock(manifestPath, () => {
    const current = existsSync(manifestPath)
      ? parseManifest(readFileSync(manifestPath, "utf8"))
      : null;
    const next = recordFixture(current, run.owner, run.database, entry);
    const temp = `${manifestPath}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temp, manifestPath);
  });
  console.info(`[e2e-fixtures] recorded ${entry.entityKind} ${entry.id}`);
};

export const uniqueSuffix = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Creates a note through POST /api/docs from inside the signed-in page. The
 * production build marks the session cookie Secure, which Playwright's API
 * client will not send over plain http, while the browser does on loopback.
 */
export const createNoteFixture = async (
  page: Page,
  note: { title: string; markdown: string; path?: string },
) => {
  if (!page.url().startsWith("http")) await page.goto("/login");
  const { status, body } = await page.evaluate(async (data) => {
    const response = await fetch("/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.text() };
  }, note);
  expect(status, "note fixture should be created").toBe(201);
  const { id } = JSON.parse(body) as { id: string };
  expect(id).toBeTruthy();
  recordAuditFixture({
    entityKind: "Doc",
    id,
    route: `/docs/${id}`,
    title: note.title,
    createdBy: "POST /api/docs",
  });
  return id;
};

export const createArchivedPageFixture = async (
  request: APIRequestContext,
  page: { title: string; url: string },
) => {
  const token =
    process.env.ARCHIVE_INGEST_TOKEN ??
    (process.env.AUDIT_RUN_MANIFEST ? "audit-harness-token" : undefined);
  if (!token) {
    throw new Error(
      "[e2e-fixtures] set ARCHIVE_INGEST_TOKEN (the audit harness uses audit-harness-token).",
    );
  }
  const response = await request.post("/api/archive/targeted-capture", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      url: page.url,
      title: page.title,
      capturedAt: new Date().toISOString(),
      skipSnapshot: true,
    },
  });
  expect(response.status(), "archived page fixture should be created").toBe(
    200,
  );
  const { pageId } = (await response.json()) as { pageId: string };
  expect(pageId).toBeTruthy();
  recordAuditFixture({
    entityKind: "ArchivedPage",
    id: pageId,
    route: "/archive",
    title: page.title,
    createdBy: "POST /api/archive/targeted-capture",
  });
  return pageId;
};

type ResearchFixture = {
  title: string;
  /** Streams, kinds, and answer, sent to PATCH /api/research/topics/:id first. */
  setup?: Record<string, unknown>;
  rounds: Array<
    Record<string, unknown> & {
      under?: string;
      links?: Array<{ from: string; to: string; kind?: string }>;
      summaries?: Array<Record<string, unknown> & { covers: string[] }>;
    }
  >;
};

/**
 * Creates a research topic and ingests a fixture's rounds through the agent
 * REST path, resolving "@ref" strings to ids returned by earlier rounds.
 */
export const createResearchTopicFixture = async (
  request: APIRequestContext,
  fixturePath: string,
  title: string,
) => {
  const token =
    process.env.RESEARCH_AGENT_TOKEN ??
    (process.env.AUDIT_RUN_MANIFEST
      ? "audit-harness-research-token"
      : undefined);
  if (!token) {
    throw new Error(
      "[e2e-fixtures] set RESEARCH_AGENT_TOKEN (the audit harness uses audit-harness-research-token).",
    );
  }
  const headers = { authorization: `Bearer ${token}` };
  const fixture = JSON.parse(
    readFileSync(fixturePath, "utf8"),
  ) as ResearchFixture;
  const created = await request.post("/api/research/topics", {
    headers,
    data: { title },
  });
  expect(created.status(), "research topic fixture should be created").toBe(
    201,
  );
  const topic = (await created.json()) as { id: string; slug: string };
  recordAuditFixture({
    entityKind: "ResearchTopic",
    id: topic.id,
    route: `/research/${topic.slug}`,
    title,
    createdBy: "POST /api/research/topics",
  });

  const known: Record<string, string> = {};
  const at = (ref: string) => (ref.startsWith("@") ? known[ref.slice(1)] : ref);
  // Streams and kinds go first so cards can name them.
  if (fixture.setup) {
    const setup = await request.patch(`/api/research/topics/${topic.id}`, {
      headers,
      data: { batchKey: "fixture-setup", agent: "fixture", ...fixture.setup },
    });
    expect(setup.status(), "research topic setup").toBe(200);
  }
  for (const round of fixture.rounds) {
    const response = await request.post(
      `/api/research/topics/${topic.id}/ingest`,
      {
        headers,
        data: {
          ...round,
          under: round.under === undefined ? undefined : at(round.under),
          links: round.links?.map((link) => ({
            ...link,
            from: at(link.from),
            to: at(link.to),
          })),
          summaries: round.summaries?.map((summary) => ({
            ...summary,
            covers: summary.covers.map(at),
          })),
        },
      },
    );
    expect(response.status(), `ingest ${String(round.batchKey)}`).toBe(200);
    const result = (await response.json()) as { refs: Record<string, string> };
    for (const [ref, id] of Object.entries(result.refs))
      if (!ref.startsWith("$")) known[ref] = id;
  }
  return topic;
};

/** True when fixtures that need direct database seeding may be created. */
export const canSeedAuditDatabase = () =>
  Boolean(process.env.AUDIT_RUN_MANIFEST && process.env.AUDIT_ENV_FILE);

/**
 * Seeds the smallest UMAP projection the Canvas route can open notes from:
 * one embedding run, one UMAP run with a single region, and a point per note.
 * No app endpoint creates these without OpenAI and the Python UMAP step, so
 * this writes directly, and only to the run manifest's synthetic database.
 * The canvas reads the newest UMAP run, so callers must not run in parallel.
 */
export const seedCanvasRegionFixture = async (
  regionTitle: string,
  notes: Array<{ id: string; title: string }>,
) => {
  const run = readRunManifest();
  const envFile = process.env.AUDIT_ENV_FILE;
  if (!run || !envFile) {
    throw new Error(
      "[e2e-fixtures] canvas seeding needs AUDIT_RUN_MANIFEST and AUDIT_ENV_FILE.",
    );
  }
  const source = parseEnv(readFileSync(envFile, "utf8"));
  if (!source.DATABASE_URL)
    throw new Error("Env file must define DATABASE_URL.");
  const datasourceUrl = auditDatabaseUrl(
    source.DATABASE_URL,
    source,
    run.database,
  ).toString();

  const points = notes.map((note, index) => ({
    docId: note.id,
    x: (index % 3) * 4,
    y: Math.floor(index / 3) * 4,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bounds = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
  const centroid = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const radius =
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 2;
  const regionsJson = {
    version: 1,
    generatedAt: new Date().toISOString(),
    maxGroups: 1,
    totalPoints: points.length,
    regions: [
      {
        id: "e2e-region",
        title: regionTitle,
        summary: "Synthetic region for browser regression tests.",
        docCount: notes.length,
        docIds: notes.map((note) => note.id),
        centroid,
        radius,
        bounds,
        islandId: "e2e-island",
        sampleDocs: notes.map((note) => ({
          docId: note.id,
          title: note.title,
          excerpt: note.title,
        })),
      },
    ],
    islands: [
      {
        id: "e2e-island",
        title: regionTitle,
        summary: "Synthetic island for browser regression tests.",
        regionIds: ["e2e-region"],
        docCount: notes.length,
        centroid,
        radius,
        bounds,
      },
    ],
  };

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl });
  try {
    const embeddingRun = await prisma.embeddingRun.create({
      data: { model: "e2e-synthetic", dims: 2, params: {} },
      select: { id: true },
    });
    recordAuditFixture({
      entityKind: "EmbeddingRun",
      id: embeddingRun.id,
      route: "/canvas",
      title: regionTitle,
      createdBy: "seedCanvasRegionFixture (direct synthetic-DB write)",
    });
    await prisma.umapRun.create({
      data: {
        embeddingRunId: embeddingRun.id,
        dims: 2,
        params: {},
        regionsJson,
        regionsUpdatedAt: new Date(),
        points: { create: points },
      },
    });
    return embeddingRun.id;
  } finally {
    await prisma.$disconnect();
  }
};
