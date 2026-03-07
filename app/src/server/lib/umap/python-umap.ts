import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { serverEnv } from "~/env/server";

const execFileAsync = promisify(execFile);
const PYTHON_DEP_CHECK = "import joblib, numpy, umap, sklearn";

export type UmapPythonParams = {
  pcaVarsToKeep?: number;
  nNeighbors?: number;
  minDist?: number;
  metric?: "cosine" | "euclidean";
  learningRate?: number;
  nEpochs?: number;
  localConnectivity?: number;
  repulsionStrength?: number;
  negativeSampleRate?: number;
  setOpMixRatio?: number;
  spread?: number;
  init?: "random" | "spectral";
  randomState?: number;
};

type TrainOutput = {
  count: number;
  dims: number;
  points: number[][];
  fitMs?: number;
  pcaComponents?: number;
};

type TransformOutput = {
  count: number;
  dims: number;
  points: number[][];
  transformMs?: number;
};

type PythonCandidate = {
  label: string;
  command: string;
};

let resolvedPythonBinPromise: Promise<string> | null = null;

function getPythonCandidates(): PythonCandidate[] {
  const candidates: PythonCandidate[] = [];
  const envBin = serverEnv.UMAP_PYTHON_BIN?.trim();

  if (envBin) {
    candidates.push({ label: "UMAP_PYTHON_BIN", command: envBin });
  }

  const bundledVenv = path.resolve(process.cwd(), ".venv", "bin", "python");
  if (!envBin || envBin !== bundledVenv) {
    candidates.push({ label: "local .venv", command: bundledVenv });
  }

  const appVenv = "/app/.venv/bin/python";
  if (appVenv !== bundledVenv && (!envBin || envBin !== appVenv)) {
    candidates.push({ label: "docker .venv", command: appVenv });
  }

  candidates.push({ label: "system python3", command: "python3" });
  return candidates;
}

async function probePythonCandidate(candidate: PythonCandidate): Promise<boolean> {
  try {
    if (candidate.command.includes(path.sep) && !existsSync(candidate.command)) {
      return false;
    }

    await execFileAsync(candidate.command, ["-c", PYTHON_DEP_CHECK], {
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

async function resolvePythonBin(): Promise<string> {
  const candidates = getPythonCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    if (await probePythonCandidate(candidate)) {
      return candidate.command;
    }

    failures.push(`${candidate.label}: ${candidate.command}`);
  }

  throw new Error(`No usable Python interpreter found. Checked ${failures.join(", ")}`);
}

function resolveUmapScriptPath(): string {
  return path.resolve(process.cwd(), "scripts", "umap_model.py");
}

function assertUmapScriptExists() {
  const script = resolveUmapScriptPath();
  if (!existsSync(script)) {
    throw new Error(`UMAP python script not found at ${script}`);
  }
}

export function resolveUmapModelDir(): string {
  const fromEnv = serverEnv.UMAP_MODEL_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "data", "umap-models");
}

export function resolveUmapArtifactPath(storedPath: string): string {
  if (path.isAbsolute(storedPath)) return storedPath;
  return path.resolve(process.cwd(), storedPath);
}

export function toStoredUmapArtifactPath(absolutePath: string): string {
  const relative = path.relative(process.cwd(), absolutePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return absolutePath;
}

async function runPythonCommand(
  command: "train" | "transform" | "check",
  payload: Record<string, unknown> | null,
  artifactPath: string | null
): Promise<Record<string, unknown>> {
  assertUmapScriptExists();
  const tempDir = await mkdtemp(path.join(tmpdir(), "vn-umap-"));
  const inputPath = path.join(tempDir, "input.json");
  const outputPath = path.join(tempDir, "output.json");
  const scriptPath = resolveUmapScriptPath();
  const args: string[] = [scriptPath, command];

  try {
    if (payload) {
      await writeFile(inputPath, JSON.stringify(payload), "utf8");
      args.push("--input", inputPath);
    }
    args.push("--output", outputPath);
    if (artifactPath) {
      args.push("--artifact", artifactPath);
    }

    const pythonBin =
      resolvedPythonBinPromise ??= resolvePythonBin().catch((error: unknown) => {
        resolvedPythonBinPromise = null;
        throw error;
      });
    await execFileAsync(await pythonBin, args, { maxBuffer: 8 * 1024 * 1024 });

    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  } catch (error) {
    const err = error as Error & { stderr?: string };
    const stderr = String(err.stderr || "").trim();
    const message = stderr || err.message || "python umap command failed";
    throw new Error(`[umap-python] ${message}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runUmapPythonHealthCheck(): Promise<Record<string, unknown>> {
  return runPythonCommand("check", null, null);
}

export async function trainUmapModel(params: {
  runId: string;
  matrix: number[][];
  dims: 2 | 3;
  umapParams?: UmapPythonParams;
}): Promise<{
  points: number[][];
  artifactPath: string;
  fitMs?: number;
  pcaComponents?: number;
}> {
  const modelDir = resolveUmapModelDir();
  await mkdir(modelDir, { recursive: true });
  const artifactAbsolutePath = path.join(modelDir, `${params.runId}.joblib`);

  const result = (await runPythonCommand(
    "train",
    {
      matrix: params.matrix,
      dims: params.dims,
      params: params.umapParams ?? {},
    },
    artifactAbsolutePath
  )) as TrainOutput;

  if (!Array.isArray(result.points)) {
    throw new Error("[umap-python] Train response missing points");
  }

  return {
    points: result.points,
    artifactPath: toStoredUmapArtifactPath(artifactAbsolutePath),
    fitMs: typeof result.fitMs === "number" ? result.fitMs : undefined,
    pcaComponents:
      typeof result.pcaComponents === "number" ? result.pcaComponents : undefined,
  };
}

export async function transformWithUmapModel(params: {
  artifactPath: string;
  matrix: number[][];
  dims: 2 | 3;
}): Promise<{ points: number[][]; transformMs?: number }> {
  const artifactAbsolutePath = resolveUmapArtifactPath(params.artifactPath);
  const result = (await runPythonCommand(
    "transform",
    {
      matrix: params.matrix,
      dims: params.dims,
    },
    artifactAbsolutePath
  )) as TransformOutput;

  if (!Array.isArray(result.points)) {
    throw new Error("[umap-python] Transform response missing points");
  }

  return {
    points: result.points,
    transformMs: typeof result.transformMs === "number" ? result.transformMs : undefined,
  };
}

export async function removeUmapArtifact(storedPath: string | null | undefined) {
  if (!storedPath) return;
  const artifactAbsolutePath = resolveUmapArtifactPath(storedPath);
  await rm(artifactAbsolutePath, { force: true });
}
