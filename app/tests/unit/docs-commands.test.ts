import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoDir = resolve(appDir, "..");

const docs = [
  join(repoDir, "AGENTS.md"),
  join(repoDir, "README.md"),
  join(appDir, "README.md"),
  ...readdirSync(join(appDir, "docs"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(appDir, "docs", name)),
];

// pnpm built-ins and package binaries that docs may call directly.
const allowed = new Set([
  "add",
  "dlx",
  "exec",
  "i",
  "install",
  "panda",
  "prisma",
  "version",
]);

const scripts = new Set(
  Object.keys(
    JSON.parse(readFileSync(join(appDir, "package.json"), "utf8")).scripts,
  ),
);

const referencedCommands = (text: string) =>
  [...text.matchAll(/\bpnpm (?:run )?([a-z][\w:-]*)/g)].map((m) => m[1]);

describe("documented pnpm commands", () => {
  it.each(docs)("exist in app/package.json: %s", (file) => {
    const missing = referencedCommands(readFileSync(file, "utf8")).filter(
      (name) => !allowed.has(name) && !scripts.has(name),
    );
    expect(missing).toEqual([]);
  });
});
