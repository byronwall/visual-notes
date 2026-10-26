import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { auditDatabaseUrl } from "./audit-harness.ts";

// Provisions one owner's synthetic audit database so agents never read the
// env file themselves: create the database, apply migrations, write a fresh
// 0600 sign-in credential, pick a free port, and print the launcher command.

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const portRange = { first: 3200, size: 200 };

type Options = {
  owner: string;
  envFile: string;
  drop: boolean;
  seedScale: number | null;
  seedCleanup: boolean;
};

function git(args: string[], cwd = appDir) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed.`);
  return result.stdout.trim();
}

/** The main checkout's app/.env, shared by every worktree. */
export function defaultEnvFile() {
  const firstWorktree = git(["worktree", "list", "--porcelain"])
    .split("\n")
    .find((line) => line.startsWith("worktree "));
  if (!firstWorktree) throw new Error("Could not find the main checkout.");
  return join(firstWorktree.slice("worktree ".length), "app/.env");
}

function parseOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv[0] === "--" ? argv.slice(1) : argv,
    options: {
      owner: { type: "string" },
      "env-file": { type: "string" },
      drop: { type: "boolean" },
      "seed-scale": { type: "string" },
      "seed-cleanup": { type: "boolean" },
    },
    strict: true,
  });
  const owner = values.owner ?? "";
  if (!/^[a-z0-9_]{1,40}$/.test(owner)) {
    throw new Error(
      "Use --owner <slug> (lowercase letters, digits, underscores). Optional: --env-file <path>, --seed-scale <notes>, --seed-cleanup, --drop.",
    );
  }
  const seedText = values["seed-scale"];
  if (seedText !== undefined && !/^\d+$/.test(seedText)) {
    throw new Error("--seed-scale takes a note count.");
  }
  return {
    owner,
    envFile: resolve(values["env-file"] ?? defaultEnvFile()),
    drop: values.drop ?? false,
    seedScale: seedText === undefined ? null : Number(seedText),
    seedCleanup: values["seed-cleanup"] ?? false,
  };
}

export function databaseName(owner: string) {
  return `visual_notes_audit_${owner}`;
}

export function passwordFile(owner: string) {
  return join(process.env.TMPDIR ?? tmpdir(), `vn-audit-${owner}.password`);
}

/** A stable starting port per owner, so reruns usually land on the same one. */
export function preferredPort(owner: string) {
  const hash = createHash("sha256").update(owner).digest().readUInt16BE(0);
  return portRange.first + (hash % portRange.size);
}

function portIsFree(port: number) {
  return new Promise<boolean>((resolvePromise) => {
    const server = createServer();
    server.once("error", () => resolvePromise(false));
    server.listen(port, "127.0.0.1", () =>
      server.close(() => resolvePromise(true)),
    );
  });
}

async function freePort(owner: string) {
  const start = preferredPort(owner);
  for (let offset = 0; offset < portRange.size; offset += 1) {
    const port =
      portRange.first + ((start - portRange.first + offset) % portRange.size);
    if (await portIsFree(port)) return port;
  }
  throw new Error("No free port from 3200 through 3399.");
}

function prisma(args: string[], databaseUrl: string, stdin?: string) {
  const result = spawnSync(
    process.execPath,
    [resolve(appDir, "node_modules/prisma/build/index.js"), ...args],
    {
      cwd: appDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      input: stdin,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `[audit-db] prisma ${args[0]} ${args[1] ?? ""} failed:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

/** Runs a vite-node seeder; it needs the app's server env to import. */
function runSeeder(args: string[], env: Record<string, string>) {
  const result = spawnSync("corepack", ["pnpm", "--silent", ...args], {
    cwd: appDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
  process.stdout.write(result.stdout);
  // vite-node exits 0 when a module throws, so require the final line too.
  if (result.status !== 0 || !result.stdout.includes("[audit-seed] seeded")) {
    throw new Error(`[audit-db] ${args[0]} failed; see the output above.`);
  }
}

export const devPostgres = {
  container: "vn-dev-pg",
  volume: "vn-dev-pg-data",
  image: "postgres:16",
};

function canConnect(host: string, port: number) {
  return new Promise<boolean>((resolvePromise) => {
    const socket = connect({ host, port, timeout: 1500 });
    const done = (ok: boolean) => {
      socket.destroy();
      resolvePromise(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function serverAddress(target: URL) {
  return {
    host: target.hostname.replace(/^\[|\]$/g, ""),
    port: Number(target.port || 5432),
  };
}

/** `docker run` for the one supported dev server; secrets pass by env name. */
export function devPostgresRunArgs(target: URL) {
  const { port } = serverAddress(target);
  return [
    "run",
    "-d",
    "--name",
    devPostgres.container,
    "-p",
    `127.0.0.1:${port}:5432`,
    "-v",
    `${devPostgres.volume}:/var/lib/postgresql/data`,
    "-e",
    "POSTGRES_USER",
    "-e",
    "POSTGRES_PASSWORD",
    devPostgres.image,
  ];
}

function docker(args: string[], env?: Record<string, string>) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

/**
 * Makes sure the env file's loopback Postgres answers. When nothing listens,
 * starts (or creates) the vn-dev-pg container on that port, so agents stop
 * improvising with Homebrew servers or other projects' containers.
 */
async function ensureDatabaseServer(target: URL) {
  const { host, port } = serverAddress(target);
  if (await canConnect(host, port)) return;
  if (docker(["info"]).status !== 0) {
    throw new Error(
      `[audit-db] Nothing listens on ${host}:${port}, and Docker isn't running. Start Docker Desktop (open -a Docker), wait until \`docker info\` succeeds, and rerun. Don't start another Postgres by hand.`,
    );
  }
  const exists =
    docker(["container", "inspect", devPostgres.container]).status === 0;
  const result = exists
    ? docker(["start", devPostgres.container])
    : docker(devPostgresRunArgs(target), {
        POSTGRES_USER: decodeURIComponent(target.username || "postgres"),
        POSTGRES_PASSWORD: decodeURIComponent(target.password),
      });
  if (result.status !== 0) {
    throw new Error(
      `[audit-db] Could not start ${devPostgres.container} on ${host}:${port}:\n${result.stderr}`,
    );
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = docker([
      "exec",
      devPostgres.container,
      "pg_isready",
      "-h",
      "127.0.0.1",
    ]);
    if (ready.status === 0 && (await canConnect(host, port))) {
      console.info(
        `[audit-db] ${exists ? "started" : "created"} ${devPostgres.container} on ${host}:${port}.`,
      );
      return;
    }
    await new Promise((wake) => setTimeout(wake, 1000));
  }
  throw new Error(
    `[audit-db] ${devPostgres.container} did not accept connections within 60s; see \`docker logs ${devPostgres.container}\`.`,
  );
}

function maintenanceUrl(target: URL) {
  const url = new URL(target);
  url.pathname = "/postgres";
  return url.toString();
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!existsSync(options.envFile)) {
    throw new Error(`Env file not found: ${options.envFile}`);
  }
  const source = parseEnv(readFileSync(options.envFile, "utf8"));
  if (!source.DATABASE_URL) throw new Error("Env file has no DATABASE_URL.");
  const database = databaseName(options.owner);
  const target = auditDatabaseUrl(source.DATABASE_URL, source, database);
  const credential = passwordFile(options.owner);
  await ensureDatabaseServer(target);

  if (options.drop) {
    // The name is prefix-checked by auditDatabaseUrl, so this can only ever
    // drop a synthetic audit database on a loopback server.
    prisma(
      ["db", "execute", "--url", maintenanceUrl(target), "--stdin"],
      maintenanceUrl(target),
      `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`,
    );
    rmSync(credential, { force: true });
    console.info(`[audit-db] dropped ${database} and its credential file.`);
    return;
  }

  // `migrate deploy` creates the database when it is missing.
  prisma(["migrate", "deploy"], target.toString());
  if (!existsSync(credential)) {
    writeFileSync(credential, randomBytes(16).toString("hex"), { mode: 0o600 });
  }
  const seedEnv = () => ({
    DATABASE_URL: target.toString(),
    AUTH_SECRET: source.AUTH_SECRET ?? "",
    MAGIC_PASSWORD: readFileSync(credential, "utf8").trim(),
    OPENAI_API_KEY: "",
  });
  if (options.seedScale !== null) {
    runSeeder(
      ["audit:seed-scale", "--notes", String(options.seedScale)],
      seedEnv(),
    );
  }
  if (options.seedCleanup) runSeeder(["audit:seed-cleanup"], seedEnv());

  const port = await freePort(options.owner);
  const worktree = git(["rev-parse", "--show-toplevel"]);
  const branch = git(["branch", "--show-current"]);
  console.info(`[audit-db] ${database} is migrated and ready.

From ${appDir}:

export AUDIT_MAGIC_PASSWORD_FILE=${credential}
export PLAYWRIGHT_MAGIC_PASSWORD_FILE=${credential}
corepack pnpm audit:harness -- --env-file ${options.envFile} --port ${port} --database ${database} --worktree ${worktree} --branch ${branch || "<your-branch>"}

Specs against it (archive and research fixtures use the launcher's tokens):
PLAYWRIGHT_BASE_URL=http://127.0.0.1:${port} ARCHIVE_INGEST_TOKEN=audit-harness-token RESEARCH_AGENT_TOKEN=audit-harness-research-token corepack pnpm exec playwright test <spec>
Browser checks against it: node tmp/<check>.mjs --base http://127.0.0.1:${port}
Clean up: corepack pnpm audit:db -- --owner ${options.owner} --drop`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
