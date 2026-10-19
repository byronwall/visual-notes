import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { parseManifest } from "./audit-fixtures.ts";

// One run manifest per launcher session. It identifies the exact source,
// runtime, fixtures, and evidence for a verifier without chat history, and it
// never contains secrets: the database is recorded by name only.

export type SourceIdentity = {
  root: string;
  branch: string;
  commit: string;
  /** sha256 of `git diff HEAD` plus untracked file names and contents. */
  diffHash: string;
};

export type ShutdownFact = { closedAt: string } | null;

export type RunManifest = {
  owner: string;
  source: SourceIdentity;
  port: number;
  database: string;
  /** Absent in manifests written before production mode existed. */
  mode?: "development" | "production";
  fixtureManifest: string | null;
  evidenceDir: string | null;
  launcher: { pid: number; serverPid: number | null; startedAt: string };
  // Page, browser, and server shutdown are separate facts.
  shutdown: {
    page: ShutdownFact;
    browser: ShutdownFact;
    server:
      | (ShutdownFact & { exitCode: number | null; signal: string | null })
      | null;
  };
};

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed in ${cwd}.`);
  }
  return result.stdout;
}

/** Paths under `exclude` (run manifest, evidence, fixtures) do not affect diffHash. */
export function sourceIdentity(
  cwd: string,
  exclude: string[] = [],
): SourceIdentity {
  const root = realpathSync(
    git(cwd, ["rev-parse", "--show-toplevel"]).toString().trim(),
  );
  const hash = createHash("sha256");
  hash.update(git(root, ["diff", "HEAD", "--binary"]));
  const untracked = git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .toString()
    .split("\0")
    .filter(Boolean)
    .filter((file) => {
      const full = resolve(root, file);
      return !exclude.some(
        (path) => full === path || full.startsWith(`${path}/`),
      );
    })
    .sort();
  for (const file of untracked) {
    hash.update(`\0${file}\0`);
    hash.update(readFileSync(resolve(root, file)));
  }
  return {
    root,
    branch: git(root, ["branch", "--show-current"]).toString().trim(),
    commit: git(root, ["rev-parse", "HEAD"]).toString().trim(),
    diffHash: hash.digest("hex"),
  };
}

export function identityExcludes(
  manifestPath: string,
  manifest: Pick<RunManifest, "fixtureManifest" | "evidenceDir">,
) {
  return [
    manifestPath,
    `${manifestPath}.tmp`,
    manifest.fixtureManifest,
    manifest.evidenceDir,
  ]
    .filter((path): path is string => Boolean(path))
    .map((path) => resolve(path));
}

export function writeRunManifest(path: string, manifest: RunManifest) {
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(temp, path);
}

export function readRunManifest(path: string): RunManifest {
  return JSON.parse(readFileSync(path, "utf8")) as RunManifest;
}

/** Returns every problem found; an empty list means the run is verifiable. */
export function verifyRunManifest(
  manifest: RunManifest,
  current: SourceIdentity,
): string[] {
  const problems: string[] = [];
  if (!manifest.owner) problems.push("owner is missing");
  if (!manifest.database?.startsWith("visual_notes_audit_")) {
    problems.push("database is missing or not a synthetic audit database");
  }
  if (!Number.isInteger(manifest.port)) problems.push("port is missing");
  if (!manifest.source) {
    problems.push("source identity is missing");
    return problems;
  }
  for (const key of ["root", "branch", "commit", "diffHash"] as const) {
    if (manifest.source[key] !== current[key]) {
      problems.push(
        `source ${key} changed: recorded ${manifest.source[key]}, now ${current[key]}`,
      );
    }
  }
  if (manifest.fixtureManifest) {
    if (!existsSync(manifest.fixtureManifest)) {
      problems.push(`fixture manifest is missing: ${manifest.fixtureManifest}`);
    } else {
      try {
        const fixtures = parseManifest(
          readFileSync(manifest.fixtureManifest, "utf8"),
        );
        if (fixtures.owner !== manifest.owner) {
          problems.push(
            `fixture manifest belongs to ${fixtures.owner}, not ${manifest.owner}`,
          );
        }
        if (fixtures.database !== manifest.database) {
          problems.push(
            `fixture manifest records database ${fixtures.database}`,
          );
        }
      } catch (error) {
        problems.push(
          `fixture manifest is invalid: ${error instanceof Error ? error.message : "unreadable"}`,
        );
      }
    }
  }
  if (manifest.evidenceDir && !existsSync(manifest.evidenceDir)) {
    problems.push(`evidence directory is missing: ${manifest.evidenceDir}`);
  }
  return problems;
}

const usage = `Usage:
  audit:run verify --manifest <path> [--artifact <relative-path>]...
  audit:run mark   --manifest <path> --closed page|browser`;

function main() {
  const [command, ...rest] = process.argv
    .slice(2)
    .filter((arg) => arg !== "--");
  const { values } = parseArgs({
    args: rest,
    options: {
      manifest: { type: "string" },
      artifact: { type: "string", multiple: true },
      closed: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.manifest) throw new Error(usage);
  const path = resolve(values.manifest);
  const manifest = readRunManifest(path);

  if (command === "verify") {
    const problems = verifyRunManifest(
      manifest,
      sourceIdentity(
        manifest.source?.root ?? ".",
        identityExcludes(path, manifest),
      ),
    );
    for (const artifact of values.artifact ?? []) {
      const base = manifest.evidenceDir;
      const full =
        isAbsolute(artifact) || !base ? artifact : resolve(base, artifact);
      if (!existsSync(full)) problems.push(`artifact is missing: ${full}`);
    }
    const { owner, port, database, source, mode } = manifest;
    console.info(
      `[audit-run] ${owner} · ${source?.branch} ${source?.commit?.slice(0, 10)} · ${mode ?? "development"} · port ${port} · ${database}`,
    );
    const { page, browser, server } = manifest.shutdown ?? {};
    console.info(
      `[audit-run] page ${page ? "closed" : "open/unknown"} · browser ${browser ? "closed" : "open/unknown"} · server ${server ? `stopped (${server.signal ?? server.exitCode})` : "running/unknown"}`,
    );
    if (problems.length) {
      for (const problem of problems)
        console.error(`[audit-run] FAIL ${problem}`);
      process.exitCode = 1;
      return;
    }
    console.info("[audit-run] verified");
    return;
  }

  if (command === "mark") {
    if (values.closed !== "page" && values.closed !== "browser")
      throw new Error(usage);
    manifest.shutdown[values.closed] = { closedAt: new Date().toISOString() };
    writeRunManifest(path, manifest);
    console.info(`[audit-run] recorded ${values.closed} closed`);
    return;
  }

  throw new Error(usage);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(
      `[audit-run] ${error instanceof Error ? error.message : "failed"}`,
    );
    process.exitCode = 1;
  }
}
