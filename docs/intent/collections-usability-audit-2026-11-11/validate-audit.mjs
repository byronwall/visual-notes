/** Read-only audit artifact checks. Run from any directory with app dependencies installed. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const require = createRequire(join(root, "app/package.json"));
const { load } = require("js-yaml");
const projectRoot = join(root, "pgm/data/projects/collections-usability");
const project = JSON.parse(
  readFileSync(join(projectRoot, "project.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(join(here, "evidence-manifest.json"), "utf8"),
);
const index = JSON.parse(readFileSync(join(here, "issue-index.json"), "utf8"));
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".git") return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const nodes = readdirSync(join(projectRoot, "nodes"))
  .filter((n) => n.endsWith(".md"))
  .map((name) => {
    const path = join(projectRoot, "nodes", name);
    const text = readFileSync(path, "utf8");
    const match = /^---\n([\s\S]*?)\n---/.exec(text);
    check(!!match, `${name}: front matter`);
    return { ...load(match?.[1] ?? ""), path };
  });
const ids = new Set(nodes.map((n) => n.id));
const types = new Set(project.nodeTypeSchema.map((n) => n.name));
check(nodes.length === ids.size, "Duplicate node IDs");
check(
  project.format === "product-grid-project" && project.formatVersion === 2,
  "Project format",
);
for (const node of nodes) {
  check(types.has(node.type), `${node.id}: undeclared type ${node.type}`);
  check(!node.parent || ids.has(node.parent), `${node.id}: missing parent`);
  for (const image of node.images ?? []) {
    const path = resolve(
      root,
      image.src.replace(/^\/api\/projects\//, "pgm/data/projects/"),
    );
    check(existsSync(path), `${node.id}: missing PGM image ${image.src}`);
    if (existsSync(path))
      check(statSync(path).size === image.size, `${node.id}: image byte count`);
  }
}
for (const entry of index.issues)
  check(existsSync(resolve(root, entry.node)), `${entry.id}: node missing`);
for (const shot of manifest.screenshots) {
  const path = resolve(root, shot.path);
  check(existsSync(path), `${shot.id}: screenshot missing`);
  if (!existsSync(path)) continue;
  const bytes = readFileSync(path);
  check(bytes[0] === 255 && bytes[1] === 216, `${shot.id}: JPEG signature`);
  let dimensions;
  for (let at = 2; at + 8 < bytes.length; ) {
    const marker = bytes[at + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
      dimensions = {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      };
      break;
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  check(
    createHash("sha256").update(bytes).digest("hex") === shot.sha256,
    `${shot.id}: SHA-256`,
  );
  check(bytes.length === shot.size, `${shot.id}: byte count`);
  check(
    dimensions?.width === shot.pixelWidth &&
      dimensions?.height === shot.pixelHeight,
    `${shot.id}: dimensions`,
  );
}
let links = 0;
for (const path of [...walk(here), ...walk(join(projectRoot, "nodes"))].filter(
  (p) => p.endsWith(".md"),
)) {
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    links++;
    check(
      existsSync(resolve(dirname(path), decodeURIComponent(target))),
      `${path}: broken link ${target}`,
    );
  }
}
console.log(
  JSON.stringify(
    {
      nodes: nodes.length,
      issues: index.issues.length,
      screenshots: manifest.screenshots.length,
      localLinksChecked: links,
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
