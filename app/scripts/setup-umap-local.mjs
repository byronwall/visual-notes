#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const venvPython = path.join(appDir, ".venv", "bin", "python");
const requirementsPath = path.join("scripts", "requirements-umap.txt");
const checkOutputPath = "/tmp/vn-umap-check.json";
const envPath = path.join(appDir, ".env");
const envKey = "UMAP_PYTHON_BIN";

function runOrThrow(cmd, args, options = {}) {
  const rendered = [cmd, ...args].join(" ");
  console.log(`[umap-setup] ${rendered}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: appDir,
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }
}

function upsertEnvVar(filePath, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${line}\n`, "utf8");
    return;
  }

  const current = readFileSync(filePath, "utf8");
  if (regex.test(current)) {
    const next = current.replace(regex, line);
    writeFileSync(filePath, next, "utf8");
    return;
  }

  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  writeFileSync(filePath, `${current}${prefix}${line}\n`, "utf8");
}

function main() {
  runOrThrow("python3", ["-m", "venv", ".venv"]);
  runOrThrow(venvPython, ["-m", "pip", "install", "-r", requirementsPath]);
  runOrThrow(venvPython, [
    "scripts/umap_model.py",
    "check",
    "--output",
    checkOutputPath,
  ]);

  upsertEnvVar(envPath, envKey, venvPython);

  console.log(`[umap-setup] Wrote ${envKey} to ${envPath}`);
  console.log("[umap-setup] Done. Restart `pnpm dev` if it is already running.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[umap-setup] ${message}`);
  process.exit(1);
}
