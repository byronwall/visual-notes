import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { load } from "js-yaml";

// Read-only consistency report for a local PGM project export
// (<root>/projects/<project>/nodes/*.md). It flags records for review; it
// never edits, deletes, or changes the status of a node.

export type PgmNode = {
  id: string;
  label: string;
  type: string;
  status: string;
  parent?: string;
  metadata: Record<string, string>;
  body: string;
  file: string;
};

export type Finding = { check: string; nodeIds: string[]; detail: string };

const openStatuses = new Set(["planned", "working", "needs-review", "blocked"]);
const actionableTypes = new Set(["problem", "module", "component"]);
const evidencePathPattern =
  /(?<![\w/.-])(?:\.\.\/)*((?:tmp|docs|app)\/[\w@./-]+\.(?:md|json|png|jpe?g|log|txt|html|zip))/g;

export function parseNode(file: string, text: string): PgmNode {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: missing front matter`);
  const front = (load(match[1]) ?? {}) as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    (front.metadata ?? {}) as Record<string, unknown>,
  )) {
    metadata[key] = value == null ? "" : String(value);
  }
  return {
    id: String(front.id ?? ""),
    label: String(front.label ?? ""),
    type: String(front.type ?? ""),
    status: String(front.status ?? ""),
    parent: front.parent ? String(front.parent) : undefined,
    metadata,
    body: match[2].trim(),
    file,
  };
}

export function readNodes(nodesDir: string): PgmNode[] {
  return readdirSync(nodesDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => parseNode(name, readFileSync(join(nodesDir, name), "utf8")));
}

const normalizeLabel = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+\d+$/, "")
    .trim();

export function evidencePaths(node: PgmNode): string[] {
  const text = [node.body, ...Object.values(node.metadata)].join("\n");
  return [...new Set([...text.matchAll(evidencePathPattern)].map((m) => m[1]))];
}

export function checkNodes(
  nodes: PgmNode[],
  pathExists: (path: string) => boolean,
): Finding[] {
  const findings: Finding[] = [];
  const ids = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    const solution = node.metadata.solution?.trim();
    if (node.status === "implemented" && !solution) {
      findings.push({
        check: "implemented-without-solution",
        nodeIds: [node.id],
        detail: "Implemented node has no solution recorded.",
      });
    }
    if (openStatuses.has(node.status) && solution) {
      findings.push({
        check: "open-with-solution",
        nodeIds: [node.id],
        detail: `Status is ${node.status} but a solution is recorded; review its disposition.`,
      });
    }
    if (node.parent && !ids.has(node.parent)) {
      findings.push({
        check: "invalid-parent",
        nodeIds: [node.id],
        detail: `Parent ${node.parent} does not exist.`,
      });
    }
    const context = [
      node.body,
      node.metadata.purpose,
      node.metadata.implementation,
    ]
      .join(" ")
      .trim();
    if (
      actionableTypes.has(node.type) &&
      openStatuses.has(node.status) &&
      context.length < 120
    ) {
      findings.push({
        check: "thin-actionable-record",
        nodeIds: [node.id],
        detail: `Open ${node.type} has ${context.length} characters of context.`,
      });
    }
    for (const path of evidencePaths(node)) {
      if (!pathExists(path)) {
        findings.push({
          check: "missing-evidence-path",
          nodeIds: [node.id],
          detail: `Referenced ${path} does not exist.`,
        });
      }
    }
  }

  const byLabel = new Map<string, PgmNode[]>();
  for (const node of nodes) {
    const key = normalizeLabel(node.label || node.id);
    byLabel.set(key, [...(byLabel.get(key) ?? []), node]);
  }
  for (const group of byLabel.values()) {
    if (group.length > 1) {
      findings.push({
        check: "duplicate-title",
        nodeIds: group.map((node) => node.id),
        detail: `${group.length} nodes share the title "${group[0].label}".`,
      });
    }
  }
  return findings;
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: {
      root: { type: "string" },
      project: { type: "string" },
      "repo-root": { type: "string" },
      json: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.root || !values.project) {
    throw new Error(
      "Usage: pgm:report --root <local pgm dir> --project <id> [--repo-root <dir>] [--json]",
    );
  }
  const nodesDir = join(
    resolve(values.root),
    "projects",
    values.project,
    "nodes",
  );
  if (!existsSync(nodesDir))
    throw new Error(`No nodes directory at ${nodesDir}.`);
  const repoRoot = resolve(values["repo-root"] ?? "..");
  const nodes = readNodes(nodesDir);
  const findings = checkNodes(nodes, (path) =>
    existsSync(join(repoRoot, path)),
  );

  if (values.json) {
    console.log(JSON.stringify({ nodes: nodes.length, findings }, null, 2));
    return;
  }
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.check, (counts.get(finding.check) ?? 0) + 1);
  }
  console.info(
    `[pgm-report] ${nodes.length} nodes, ${findings.length} findings`,
  );
  for (const [check, count] of counts) console.info(`  ${check}: ${count}`);
  for (const finding of findings) {
    console.info(
      `- ${finding.check} · ${finding.nodeIds.join(", ")} · ${finding.detail}`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(
      `[pgm-report] ${error instanceof Error ? error.message : "failed"}`,
    );
    process.exitCode = 1;
  }
}
