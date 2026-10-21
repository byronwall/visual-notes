import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import { auditDatabaseUrl } from "./audit-harness.ts";

// Fixture ownership comes only from an owner's own creation responses.
// Cleanup refuses any ID that is not recorded in that owner's manifest, and
// all checks run before a database connection is opened.

export const fixtureModels = {
  Doc: "doc",
  ArchivedPage: "archivedPage",
  TaskList: "taskList",
  TimeBlock: "timeBlock",
  // Deleting an EmbeddingRun cascades to its UmapRun and UmapPoint rows.
  EmbeddingRun: "embeddingRun",
  // Deleting a ResearchTopic cascades to its cards, links, summaries, and batches.
  ResearchTopic: "researchTopic",
} as const;

export type EntityKind = keyof typeof fixtureModels;

export type FixtureEntry = {
  entityKind: EntityKind;
  id: string;
  route: string;
  title?: string;
  createdBy?: string;
};

export type FixtureManifest = {
  owner: string;
  database: string;
  fixtures: FixtureEntry[];
};

const ownerPattern = /^[a-z0-9][a-z0-9_-]*$/;

function assertEntityKind(kind: string): asserts kind is EntityKind {
  if (!Object.prototype.hasOwnProperty.call(fixtureModels, kind)) {
    throw new Error(
      `Unsupported entity kind ${kind}. Use one of: ${Object.keys(fixtureModels).join(", ")}.`,
    );
  }
}

export function parseManifest(text: string): FixtureManifest {
  const data = JSON.parse(text) as Partial<FixtureManifest>;
  if (typeof data.owner !== "string" || !ownerPattern.test(data.owner)) {
    throw new Error("Manifest must name an owner.");
  }
  if (typeof data.database !== "string" || !data.database) {
    throw new Error("Manifest must name a database.");
  }
  if (!Array.isArray(data.fixtures)) {
    throw new Error("Manifest must contain a fixtures array.");
  }
  for (const entry of data.fixtures) {
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      throw new Error("Every manifest fixture needs the created ID.");
    }
    assertEntityKind(String(entry.entityKind));
    if (typeof entry.route !== "string" || !entry.route) {
      throw new Error(`Fixture ${entry.id} needs its app route.`);
    }
  }
  return data as FixtureManifest;
}

function assertManifestScope(
  manifest: FixtureManifest,
  owner: string,
  database: string,
) {
  if (manifest.owner !== owner) {
    throw new Error(
      `Manifest belongs to ${manifest.owner}, not ${owner}. Cleanup refused.`,
    );
  }
  if (manifest.database !== database) {
    throw new Error(
      `Manifest records database ${manifest.database}, not ${database}. Cleanup refused.`,
    );
  }
}

export function recordFixture(
  manifest: FixtureManifest | null,
  owner: string,
  database: string,
  entry: FixtureEntry,
): FixtureManifest {
  if (!ownerPattern.test(owner)) throw new Error("Owner must be a short slug.");
  assertEntityKind(entry.entityKind);
  const next = manifest ?? { owner, database, fixtures: [] };
  assertManifestScope(next, owner, database);
  if (next.fixtures.some((fixture) => fixture.id === entry.id)) {
    throw new Error(`Fixture ${entry.id} is already recorded.`);
  }
  return { ...next, fixtures: [...next.fixtures, entry] };
}

/** Returns the owned fixture for cleanup, or throws before any mutation. */
export function resolveOwnedFixture(
  manifest: FixtureManifest,
  owner: string,
  database: string,
  id: string,
  entityKind?: string,
): FixtureEntry {
  assertManifestScope(manifest, owner, database);
  const fixture = manifest.fixtures.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(
      `Fixture ${id} is not recorded for ${owner}. Cleanup refused.`,
    );
  }
  if (entityKind && entityKind !== fixture.entityKind) {
    throw new Error(
      `Fixture ${id} is recorded as ${fixture.entityKind}, not ${entityKind}. Cleanup refused.`,
    );
  }
  return fixture;
}

export function withoutFixture(
  manifest: FixtureManifest,
  id: string,
): FixtureManifest {
  return {
    ...manifest,
    fixtures: manifest.fixtures.filter((entry) => entry.id !== id),
  };
}

function readManifest(path: string) {
  return existsSync(path) ? parseManifest(readFileSync(path, "utf8")) : null;
}

function writeManifest(path: string, manifest: FixtureManifest) {
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(temp, path);
}

const usage = `Usage:
  audit:fixtures record  --manifest <path> --owner <slug> --database <name> --kind <Kind> --id <created-id> --route <url> [--title <t>] [--created-by <action>]
  audit:fixtures cleanup --manifest <path> --owner <slug> --database <name> --id <created-id> --env-file <path> [--kind <Kind>] [--dry-run]`;

async function deleteFixture(
  envFile: string,
  database: string,
  fixture: FixtureEntry,
) {
  const source = parseEnv(readFileSync(envFile, "utf8"));
  if (!source.DATABASE_URL)
    throw new Error("Env file must define DATABASE_URL.");
  const datasourceUrl = auditDatabaseUrl(
    source.DATABASE_URL,
    source,
    database,
  ).toString();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl });
  try {
    const model = (
      prisma as unknown as Record<
        string,
        { deleteMany: (args: unknown) => Promise<{ count: number }> }
      >
    )[fixtureModels[fixture.entityKind]];
    const result = await model.deleteMany({ where: { id: fixture.id } });
    return result.count;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [command, ...rest] = process.argv
    .slice(2)
    .filter((arg) => arg !== "--");
  const { values } = parseArgs({
    args: rest,
    options: {
      manifest: { type: "string" },
      owner: { type: "string" },
      database: { type: "string" },
      kind: { type: "string" },
      id: { type: "string" },
      route: { type: "string" },
      title: { type: "string" },
      "created-by": { type: "string" },
      "env-file": { type: "string" },
      "dry-run": { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  const { manifest: manifestArg, owner, database, id } = values;
  if (!manifestArg || !owner || !database || !id) throw new Error(usage);
  const manifestPath = resolve(manifestArg);

  if (command === "record") {
    if (!values.kind || !values.route) throw new Error(usage);
    assertEntityKind(values.kind);
    const next = recordFixture(readManifest(manifestPath), owner, database, {
      entityKind: values.kind,
      id,
      route: values.route,
      title: values.title,
      createdBy: values["created-by"],
    });
    writeManifest(manifestPath, next);
    console.info(`[audit-fixtures] recorded ${values.kind} ${id} for ${owner}`);
    return;
  }

  if (command === "cleanup") {
    const manifest = readManifest(manifestPath);
    if (!manifest)
      throw new Error(`No manifest at ${manifestPath}. Cleanup refused.`);
    const fixture = resolveOwnedFixture(
      manifest,
      owner,
      database,
      id,
      values.kind,
    );
    if (values["dry-run"]) {
      console.info(
        `[audit-fixtures] would delete ${fixture.entityKind} ${fixture.id} from ${database}`,
      );
      return;
    }
    if (!values["env-file"]) throw new Error(usage);
    const count = await deleteFixture(values["env-file"], database, fixture);
    writeManifest(manifestPath, withoutFixture(manifest, fixture.id));
    console.info(
      count === 1
        ? `[audit-fixtures] deleted ${fixture.entityKind} ${fixture.id} from ${database}`
        : `[audit-fixtures] ${fixture.entityKind} ${fixture.id} was already absent from ${database}; removed it from the manifest`,
    );
    return;
  }

  throw new Error(usage);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(
      `[audit-fixtures] ${error instanceof Error ? error.message : "failed"}`,
    );
    process.exitCode = 1;
  });
}
