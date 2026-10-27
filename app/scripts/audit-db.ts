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

// Dev Postgres is Homebrew's, shared by every worktree; each worktree or
// owner gets its own database on it. Idle, the server uses about 30 MB.
export const devPostgres = { formula: "postgresql@18" };

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

/** SQL that creates the env file's login role; the password stays out of argv. */
export function createRoleSql(target: URL) {
  const user = decodeURIComponent(target.username || "postgres");
  const password = decodeURIComponent(target.password).replaceAll("'", "''");
  return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${user.replaceAll("'", "''")}') THEN
    CREATE ROLE "${user.replaceAll('"', '""')}" WITH LOGIN SUPERUSER PASSWORD '${password}';
  END IF;
END $$;`;
}

function run(command: string, args: string[], input?: string) {
  return spawnSync(command, args, { encoding: "utf8", input });
}

/**
 * Makes sure the env file's loopback Postgres answers and knows the env
 * file's role. When nothing listens, starts Homebrew's postgresql@18 service
 * (installing it first if needed), so no worktree needs Docker.
 */
async function ensureDatabaseServer(target: URL) {
  const { host, port } = serverAddress(target);
  if (!(await canConnect(host, port))) {
    if (run("brew", ["--version"]).status !== 0) {
      throw new Error(
        `[audit-db] Nothing listens on ${host}:${port}, and Homebrew isn't installed. Install Homebrew, then rerun.`,
      );
    }
    if (run("brew", ["list", devPostgres.formula]).status !== 0) {
      console.info(`[audit-db] installing ${devPostgres.formula}…`);
      const install = spawnSync("brew", ["install", devPostgres.formula], {
        stdio: "inherit",
      });
      if (install.status !== 0)
        throw new Error("[audit-db] brew install failed.");
    }
    const started = run("brew", ["services", "start", devPostgres.formula]);
    if (started.status !== 0) {
      throw new Error(
        `[audit-db] Could not start ${devPostgres.formula}:\n${started.stderr}`,
      );
    }
    let ready = false;
    for (let attempt = 0; attempt < 30 && !ready; attempt += 1) {
      await new Promise((wake) => setTimeout(wake, 1000));
      ready = await canConnect(host, port);
    }
    if (!ready) {
      throw new Error(
        `[audit-db] ${devPostgres.formula} did not listen on ${host}:${port} within 30s; check \`brew services info ${devPostgres.formula}\` and its log in $(brew --prefix)/var/log.`,
      );
    }
    console.info(
      `[audit-db] started ${devPostgres.formula} on ${host}:${port}.`,
    );
  }
  // Homebrew's initdb makes only the macOS user a superuser. Connect as that
  // user to add the env file's role; a no-op once it exists.
  const bin = run("brew", ["--prefix", devPostgres.formula]).stdout.trim();
  const psql = bin ? join(bin, "bin/psql") : "psql";
  const role = run(
    psql,
    [
      "-h",
      host,
      "-p",
      String(port),
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    createRoleSql(target),
  );
  if (role.status !== 0) {
    console.warn(
      `[audit-db] could not check the database role:\n${role.stderr}`,
    );
  }
  // Docker containers and other Homebrew versions also default to 5432 and
  // can bind beside this server, so check which one actually answers.
  const answer = spawnSync(
    psql,
    [
      "-h",
      host,
      "-p",
      String(port),
      "-U",
      decodeURIComponent(target.username || "postgres"),
      "-d",
      "postgres",
      "-Atc",
      "SELECT version()",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: decodeURIComponent(target.password) },
    },
  );
  if (!answer.stdout.includes("Homebrew")) {
    throw new Error(
      `[audit-db] ${host}:${port} is not Homebrew's ${devPostgres.formula}: ${(answer.stdout || answer.stderr).trim()}\nStop the other server (a Docker container such as vn-db2, or another \`brew services\` Postgres), then rerun.`,
    );
  }
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
