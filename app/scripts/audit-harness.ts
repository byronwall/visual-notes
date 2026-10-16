import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseArgs as parseCliArgs, parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  identityExcludes,
  sourceIdentity,
  writeRunManifest,
  type RunManifest,
} from "./audit-run.ts";

type Options = {
  envFile: string;
  port: number;
  database: string;
  worktree: string;
  branch: string;
  /** Build once and serve the production bundle instead of `vinxi dev`. */
  production: boolean;
  run?: {
    owner: string;
    manifest: string;
    fixtures: string | null;
    evidence: string | null;
  };
};

const databasePrefix = "visual_notes_audit_";

function parseArgs(args: string[]): Options | null {
  const parsed = parseCliArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: {
      "env-file": { type: "string" },
      port: { type: "string" },
      database: { type: "string" },
      worktree: { type: "string" },
      branch: { type: "string" },
      owner: { type: "string" },
      "run-manifest": { type: "string" },
      fixtures: { type: "string" },
      evidence: { type: "string" },
      production: { type: "boolean" },
      "self-check": { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (parsed.values["self-check"]) {
    if (Object.keys(parsed.values).length !== 1) {
      throw new Error("Use --self-check alone.");
    }
    return null;
  }

  const {
    "env-file": envFile,
    port: portText,
    database,
    worktree,
    branch,
  } = parsed.values;
  if (
    !envFile ||
    !portText ||
    !database ||
    !worktree ||
    !branch ||
    !isAbsolute(worktree) ||
    !/^\d+$/.test(portText)
  ) {
    throw new Error(
      "Use --env-file <path> --port <1024-65535> --database <synthetic-name> --worktree <absolute-path> --branch <name> [--production].",
    );
  }

  const port = Number(portText);
  if (port < 1024 || port > 65535)
    throw new Error(
      "Port must be an explicit integer from 1024 through 65535.",
    );
  if (!new RegExp(`^${databasePrefix}[a-z0-9_]+$`).test(database)) {
    throw new Error(
      `Database must start with ${databasePrefix} and use lowercase letters, digits, or underscores.`,
    );
  }

  const {
    owner,
    "run-manifest": runManifest,
    fixtures,
    evidence,
  } = parsed.values;
  if ((owner || fixtures || evidence) && !runManifest) {
    throw new Error(
      "--owner, --fixtures, and --evidence require --run-manifest.",
    );
  }
  if (runManifest && !owner)
    throw new Error("--run-manifest requires --owner.");

  return {
    envFile: resolve(envFile),
    port,
    database,
    worktree,
    branch,
    production: parsed.values.production ?? false,
    run:
      runManifest && owner
        ? {
            owner,
            manifest: resolve(runManifest),
            fixtures: fixtures ? resolve(fixtures) : null,
            evidence: evidence ? resolve(evidence) : null,
          }
        : undefined,
  };
}

function assertAssignment(
  actualRoot: string,
  actualBranch: string,
  expectedRoot: string,
  expectedBranch: string,
) {
  if (resolve(actualRoot) !== resolve(expectedRoot)) {
    throw new Error("Current Git worktree does not match --worktree.");
  }
  if (
    !actualBranch ||
    actualBranch === "main" ||
    actualBranch !== expectedBranch
  ) {
    throw new Error("Current Git branch does not match --branch.");
  }
}

function expandEnvReferences(
  value: string,
  source: Record<string, string | undefined>,
) {
  const expanded = value.replace(
    /\$\{([A-Z][A-Z0-9_]*)\}/g,
    (_match, name: string) => {
      const replacement = source[name];
      if (replacement === undefined) {
        throw new Error(
          `Env file does not define ${name}, referenced by DATABASE_URL.`,
        );
      }
      return replacement;
    },
  );
  if (expanded.includes("${")) {
    throw new Error(
      "DATABASE_URL has an unsupported or recursive env reference.",
    );
  }
  return expanded;
}

/** Rewrites DATABASE_URL to a synthetic database on a loopback PostgreSQL host. */
export function auditDatabaseUrl(
  rawUrl: string,
  source: Record<string, string | undefined>,
  database: string,
) {
  if (!new RegExp(`^${databasePrefix}[a-z0-9_]+$`).test(database)) {
    throw new Error(`Database must start with ${databasePrefix}.`);
  }
  let dbUrl: URL;
  const expandedUrl = expandEnvReferences(rawUrl, source);
  try {
    dbUrl = new URL(expandedUrl);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  }
  if (dbUrl.pathname === "/") {
    throw new Error("DATABASE_URL must name a database.");
  }
  if (
    !["postgres:", "postgresql:"].includes(dbUrl.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname)
  ) {
    throw new Error("DATABASE_URL must point to a loopback PostgreSQL server.");
  }
  dbUrl.pathname = `/${database}`;
  return dbUrl;
}

function makeChildEnv(
  source: Record<string, string | undefined>,
  options: Options,
  auditMagicPassword: string | undefined,
) {
  const rawUrl = source.DATABASE_URL;
  const authSecret = source.AUTH_SECRET;
  if (!rawUrl || !authSecret || !auditMagicPassword) {
    throw new Error(
      "Env file must define DATABASE_URL and AUTH_SECRET; set AUDIT_MAGIC_PASSWORD_FILE (or AUDIT_MAGIC_PASSWORD) for this worktree.",
    );
  }

  const dbUrl = auditDatabaseUrl(rawUrl, source, options.database);

  const baseUrl = `http://127.0.0.1:${options.port}`;
  const childEnv: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "TERM",
    "NO_COLOR",
    "FORCE_COLOR",
    "CI",
  ]) {
    const value = process.env[key];
    if (value !== undefined) childEnv[key] = value;
  }
  Object.assign(childEnv, {
    NODE_ENV: options.production ? "production" : "development",
    DATABASE_URL: dbUrl.toString(),
    AUTH_SECRET: authSecret,
    AUTH_TRUST_HOST: source.AUTH_TRUST_HOST ?? "true",
    AUTH_URL: baseUrl,
    PUBLIC_BASE_URL: baseUrl,
    MAGIC_PASSWORD: auditMagicPassword,
    ARCHIVE_INGEST_TOKEN: "audit-harness-token",
    VITE_AUTH_PATH: source.VITE_AUTH_PATH ?? "/api/auth",
    VITE_PUBLIC_BASE_URL: baseUrl,
    PORT: String(options.port),
    HOST: "127.0.0.1",
    PLAYWRIGHT_PORT: String(options.port),
    PLAYWRIGHT_SERVER_PORT: String(options.port),
    PLAYWRIGHT_BASE_URL: baseUrl,
    OPENAI_API_KEY: "",
  });
  return childEnv;
}

async function assertPortFree(port: number) {
  try {
    await new Promise<void>((resolvePromise, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      );
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      throw new Error(`Port ${port} is already in use.`);
    }
    throw new Error(
      `Could not check whether port ${port} is free${code ? ` (${code})` : ""}.`,
    );
  }
}

function selfCheck() {
  const options: Options = {
    envFile: "/tmp/audit.env",
    port: 3115,
    database: "visual_notes_audit_test",
    worktree: "/worktree/a",
    branch: "codex/a",
    production: false,
  };
  const env = makeChildEnv(
    {
      DATABASE_URL: "postgresql://local:pass@localhost:5432/source",
      AUTH_SECRET: "auth-secret",
      OPENAI_API_KEY: "must-not-pass",
      MAGIC_PASSWORD: "must-not-be-used",
    },
    options,
    "test-only-password",
  );
  assert.equal(new URL(env.DATABASE_URL!).pathname, "/visual_notes_audit_test");
  assert.equal(env.MAGIC_PASSWORD, "test-only-password");
  assert.equal(env.OPENAI_API_KEY, "");
  assert.equal(env.NODE_ENV, "development");
  assert.equal(
    makeChildEnv(
      { DATABASE_URL: "postgresql://localhost/db", AUTH_SECRET: "x" },
      { ...options, production: true },
      "test-only-password",
    ).NODE_ENV,
    "production",
  );
  assert.throws(
    () =>
      makeChildEnv(
        { DATABASE_URL: "postgresql://localhost/db", AUTH_SECRET: "x" },
        options,
        undefined,
      ),
    /AUDIT_MAGIC_PASSWORD/,
  );
  assert.throws(
    () =>
      makeChildEnv(
        { DATABASE_URL: "postgresql://db.example.com/db", AUTH_SECRET: "x" },
        options,
        "test-only-password",
      ),
    /loopback/,
  );
  assert.throws(() =>
    assertAssignment(
      "/worktree/b",
      options.branch,
      options.worktree,
      options.branch,
    ),
  );
  assert.throws(() =>
    assertAssignment(
      options.worktree,
      "main",
      options.worktree,
      options.branch,
    ),
  );
  assert.throws(() =>
    assertAssignment(options.worktree, "main", options.worktree, "main"),
  );
}

async function start(options: Options) {
  const packageJsonPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../package.json",
  );
  const pnpmPath = process.env.npm_execpath;
  if (!pnpmPath) throw new Error("Run through pnpm: pnpm audit:harness -- ...");
  const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: dirname(packageJsonPath),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const gitBranch = spawnSync("git", ["branch", "--show-current"], {
    cwd: dirname(packageJsonPath),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (gitRoot.status !== 0 || gitBranch.status !== 0) {
    throw new Error("Could not verify the assigned Git worktree and branch.");
  }
  assertAssignment(
    realpathSync(gitRoot.stdout.trim()),
    gitBranch.stdout.trim(),
    realpathSync(options.worktree),
    options.branch,
  );
  const version = spawnSync(process.execPath, [pnpmPath, "--version"], {
    cwd: dirname(packageJsonPath),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (version.status !== 0 || version.stdout.trim() !== "9.15.9") {
    throw new Error("Run this launcher with Corepack-pinned pnpm@9.15.9.");
  }

  const source = parseEnv(readFileSync(options.envFile, "utf8"));
  delete source.MAGIC_PASSWORD;
  const passwordFile = process.env.AUDIT_MAGIC_PASSWORD_FILE;
  const auditMagicPassword = passwordFile
    ? readFileSync(passwordFile, "utf8").trim()
    : process.env.AUDIT_MAGIC_PASSWORD;
  const childEnv = makeChildEnv(source, options, auditMagicPassword);
  await assertPortFree(options.port);

  const codegen = spawnSync(
    process.execPath,
    [pnpmPath, "exec", "panda", "codegen"],
    {
      cwd: dirname(packageJsonPath),
      env: childEnv,
      stdio: "inherit",
    },
  );
  const cssEntry = resolve(
    dirname(packageJsonPath),
    "styled-system/css/index.mjs",
  );
  if (
    codegen.status !== 0 ||
    !existsSync(cssEntry) ||
    statSync(cssEntry).size === 0
  ) {
    throw new Error(
      "Panda codegen did not create styled-system/css/index.mjs.",
    );
  }

  if (options.production) {
    const build = spawnSync(
      process.execPath,
      [pnpmPath, "exec", "vinxi", "build"],
      { cwd: dirname(packageJsonPath), env: childEnv, stdio: "inherit" },
    );
    if (build.status !== 0) throw new Error("Production build failed.");
  }

  const vinxiCommand = options.production ? "start" : "dev";
  const child = spawn(
    process.execPath,
    [pnpmPath, "exec", "vinxi", vinxiCommand],
    {
      cwd: dirname(packageJsonPath),
      env: childEnv,
      detached: true,
      stdio: "inherit",
    },
  );
  const run = options.run;
  let runManifest: RunManifest | null = null;
  if (run) {
    const paths = { fixtureManifest: run.fixtures, evidenceDir: run.evidence };
    runManifest = {
      owner: run.owner,
      source: sourceIdentity(
        dirname(packageJsonPath),
        identityExcludes(run.manifest, paths),
      ),
      port: options.port,
      database: options.database,
      mode: options.production ? "production" : "development",
      ...paths,
      launcher: {
        pid: process.pid,
        serverPid: child.pid ?? null,
        startedAt: new Date().toISOString(),
      },
      shutdown: { page: null, browser: null, server: null },
    };
    writeRunManifest(run.manifest, runManifest);
    console.info(`[audit-harness] run manifest: ${run.manifest}`);
  }
  let stopping = false;
  const stop = (signal: NodeJS.Signals) => {
    if (stopping || !child.pid) return;
    stopping = true;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const onInt = () => stop("SIGINT");
  const onTerm = () => stop("SIGTERM");
  process.once("SIGINT", onInt);
  process.once("SIGTERM", onTerm);
  process.once("exit", () => stop("SIGTERM"));
  child.once("error", (error) => {
    console.error(`[audit-harness] could not start pnpm: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (run && runManifest) {
      // Keep page/browser facts recorded by `audit:run mark` since start.
      const latest = JSON.parse(
        readFileSync(run.manifest, "utf8"),
      ) as RunManifest;
      latest.shutdown.server = {
        closedAt: new Date().toISOString(),
        exitCode: code,
        signal,
      };
      writeRunManifest(run.manifest, latest);
    }
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
    process.exitCode = signal ? 1 : code ?? 1;
  });

  console.info(
    `[audit-harness] starting ${options.production ? "production build" : "dev server"} on http://127.0.0.1:${options.port} with synthetic database ${options.database}`,
  );
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options) {
      selfCheck();
      console.info("[audit-harness] safety self-check passed");
      return;
    }
    await start(options);
  } catch (error) {
    console.error(
      `[audit-harness] ${error instanceof Error ? error.message : "failed"}`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main();
