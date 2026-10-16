import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  identityExcludes,
  sourceIdentity,
  verifyRunManifest,
  type RunManifest,
} from "../../scripts/audit-run.ts";

const makeRepo = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "vn-run-")));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q", "-b", "audit/branch");
  writeFileSync(join(root, "a.txt"), "one\n");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  return root;
};

const manifestFor = (root: string, evidenceDir: string): RunManifest => ({
  owner: "harness",
  source: sourceIdentity(root, [evidenceDir]),
  port: 3115,
  database: "visual_notes_audit_harness",
  fixtureManifest: null,
  evidenceDir,
  launcher: { pid: 1, serverPid: 2, startedAt: "2026-10-16T00:00:00Z" },
  shutdown: { page: null, browser: null, server: null },
});

describe("audit run manifest", () => {
  it("verifies the recorded source and ignores evidence written later", () => {
    const root = makeRepo();
    const evidence = join(root, "evidence");
    mkdirSync(evidence);
    const manifest = manifestFor(root, evidence);
    writeFileSync(join(evidence, "shot.png"), "x");
    expect(
      verifyRunManifest(manifest, sourceIdentity(root, [evidence])),
    ).toEqual([]);
  });

  it("fails when tracked or untracked source changes", () => {
    const root = makeRepo();
    mkdirSync(join(root, "evidence"));
    const manifest = manifestFor(root, join(root, "evidence"));
    writeFileSync(join(root, "a.txt"), "two\n");
    expect(verifyRunManifest(manifest, sourceIdentity(root))).toEqual([
      expect.stringMatching(/diffHash changed/),
    ]);
    writeFileSync(join(root, "a.txt"), "one\n");
    writeFileSync(join(root, "new.ts"), "x");
    expect(verifyRunManifest(manifest, sourceIdentity(root))).toEqual([
      expect.stringMatching(/diffHash changed/),
    ]);
  });

  it("reports missing fixture manifests, evidence, and unsafe databases", () => {
    const root = makeRepo();
    const manifest = {
      ...manifestFor(root, join(root, "missing-evidence")),
      database: "visual_notes",
      fixtureManifest: join(root, "missing.json"),
    };
    const problems = verifyRunManifest(manifest, manifest.source);
    expect(problems).toEqual([
      expect.stringMatching(/synthetic audit database/),
      expect.stringMatching(/fixture manifest is missing/),
      expect.stringMatching(/evidence directory is missing/),
    ]);
  });

  it("excludes the manifest, its temp file, fixtures, and evidence", () => {
    expect(
      identityExcludes("/r/run.json", {
        fixtureManifest: "/r/fx.json",
        evidenceDir: null,
      }),
    ).toEqual(["/r/run.json", "/r/run.json.tmp", "/r/fx.json"]);
  });
});
