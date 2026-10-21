import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
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
    },
    strict: true,
  });
  const owner = values.owner ?? "";
  if (!/^[a-z0-9_]{1,40}$/.test(owner)) {
    throw new Error(
      "Use --owner <slug> (lowercase letters, digits, underscores). Optional: --env-file <path>, --seed-scale <notes>, --drop.",
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

/** Runs the vite-node seeder; it needs the app's server env to import. */
function seedScale(notes: number, env: Record<string, string>) {
  const result = spawnSync(
    "corepack",
    ["pnpm", "--silent", "audit:seed-scale", "--notes", String(notes)],
    {
      cwd: appDir,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
    },
  );
  process.stdout.write(result.stdout);
  // vite-node exits 0 when a module throws, so require the final line too.
  if (result.status !== 0 || !result.stdout.includes("[audit-seed] seeded")) {
    throw new Error("[audit-db] scale seed failed; see the output above.");
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
  if (options.seedScale !== null) {
    seedScale(options.seedScale, {
      DATABASE_URL: target.toString(),
      AUTH_SECRET: source.AUTH_SECRET ?? "",
      MAGIC_PASSWORD: readFileSync(credential, "utf8").trim(),
      OPENAI_API_KEY: "",
    });
  }

  const port = await freePort(options.owner);
  const worktree = git(["rev-parse", "--show-toplevel"]);
  const branch = git(["branch", "--show-current"]);
  console.info(`[audit-db] ${database} is migrated and ready.

From ${appDir}:

export AUDIT_MAGIC_PASSWORD_FILE=${credential}
export PLAYWRIGHT_MAGIC_PASSWORD_FILE=${credential}
corepack pnpm audit:harness -- --env-file ${options.envFile} --port ${port} --database ${database} --worktree ${worktree} --branch ${branch || "<your-branch>"}

Specs against it (archive fixtures use the launcher's ingest token):
PLAYWRIGHT_BASE_URL=http://127.0.0.1:${port} ARCHIVE_INGEST_TOKEN=audit-harness-token corepack pnpm exec playwright test <spec>
Clean up: corepack pnpm audit:db -- --owner ${options.owner} --drop`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
