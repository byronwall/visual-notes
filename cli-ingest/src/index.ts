#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type RawNote = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folder: string;
  html?: string;
  filePath?: string;
};

type JxaResult =
  | RawNote[]
  | {
      notes: RawNote[];
      wrote?: number;
      skipped?: number;
      outDir?: string | null;
      inline?: boolean;
    };

type ExportedNote = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folder: string;
  markdown: string;
};

async function runJxaScript(
  scriptPath: string,
  env?: NodeJS.ProcessEnv,
  options?: { verbose?: boolean; passthroughStdout?: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "/usr/bin/osascript",
      ["-l", "JavaScript", scriptPath],
      {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (options?.passthroughStdout || options?.verbose) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      process.stderr.write(chunk);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start osascript: ${err.message}`));
    });

    child.on("close", (code, signal) => {
      if (code === 0) return resolve(output);
      reject(
        new Error(
          `Failed to execute JXA script: exitCode=${code} signal=${
            signal ?? ""
          }`
        )
      );
    });
  });
}

async function main(): Promise<void> {
  // Resolve paths relative to the CLI package root, works in tsx (src) and node (dist)
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = dirname(currentDir);
  const scriptsDir = join(repoRoot, "scripts");
  const outDir = join(repoRoot, "out");
  const scriptPath = join(scriptsDir, "export-apple-notes.jxa");

  mkdirSync(outDir, { recursive: true });

  const allowDummy = process.argv.includes("--allow-dummy");
  const verbose =
    process.argv.includes("--verbose") || process.argv.includes("-v");
  const debugJxa = process.argv.includes("--debug-jxa");

  // optional flags for per-note file output (markdown)
  const split = process.argv.includes("--split");
  let splitDir = join(outDir, "notes-md");
  const splitDirIndex = process.argv.findIndex((a) => a === "--split-dir");
  if (splitDirIndex !== -1) {
    const val = process.argv[splitDirIndex + 1];
    if (val) splitDir = val.startsWith("/") ? val : join(process.cwd(), val);
  }

  // ask JXA to write raw HTML per-note (default to out/notes-html)
  let jxaRawDir: string | undefined = join(outDir, "notes-html");
  const jxaRawIndex = process.argv.findIndex((a) => a === "--jxa-raw-dir");
  if (jxaRawIndex !== -1) {
    const val = process.argv[jxaRawIndex + 1];
    if (val) jxaRawDir = val.startsWith("/") ? val : join(process.cwd(), val);
  }

  // optional: pass INLINE_HTML=1 to force inline JSON (no files)
  const inlineJson = process.argv.includes("--inline-json");

  // optional: filter notes modified since epoch seconds
  let sinceEpochSec: number | undefined;
  const sinceFlagIndex = process.argv.findIndex(
    (a) => a === "--since" || a === "--since-epoch"
  );
  if (sinceFlagIndex !== -1) {
    const val = process.argv[sinceFlagIndex + 1];
    const parsed = val ? Number(val) : NaN;
    if (!Number.isNaN(parsed) && parsed > 0) sinceEpochSec = Math.floor(parsed);
  }

  // parse --limit / -n N (default 10)
  let limit = 10;
  const limitFlagIndex = process.argv.findIndex(
    (a) => a === "--limit" || a === "-n"
  );
  if (limitFlagIndex !== -1) {
    const val = process.argv[limitFlagIndex + 1];
    const parsed = val ? Number(val) : NaN;
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.floor(parsed);
    }
  }

  if (verbose) {
    console.log("[visual-notes-ingest] Starting export...");
    console.log(`[visual-notes-ingest] CLI root: ${repoRoot}`);
    console.log(`[visual-notes-ingest] Script path: ${scriptPath}`);
    console.log(`[visual-notes-ingest] Output dir: ${outDir}`);
    if (split) console.log(`[visual-notes-ingest] Split dir: ${splitDir}`);
    if (jxaRawDir)
      console.log(`[visual-notes-ingest] JXA raw dir: ${jxaRawDir}`);
    console.log(`[visual-notes-ingest] Limit: ${limit}`);
  }

  let rawJson: string;
  try {
    if (verbose)
      console.log("[visual-notes-ingest] Running JXA script via osascript...");
    const jxaEnv: NodeJS.ProcessEnv = {
      LIMIT: String(limit),
      ...(jxaRawDir ? { HTML_OUT_DIR: jxaRawDir } : {}),
      ...(inlineJson ? { INLINE_HTML: "1" } : {}),
      ...(sinceEpochSec ? { SINCE_EPOCH_SEC: String(sinceEpochSec) } : {}),
      ...(debugJxa ? { JXA_DEBUG: "1" } : {}),
    };
    rawJson = await runJxaScript(scriptPath, jxaEnv, {
      verbose,
      passthroughStdout: process.argv.includes("--jxa-stdout"),
    });
    if (verbose) console.log("[visual-notes-ingest] JXA execution complete.");
  } catch (err) {
    if (!allowDummy) throw err as Error;
    // Use a small deterministic sample to prove the pipeline without permissions
    const sample: RawNote[] = [
      {
        id: "sample-1",
        title: "Sample Note",
        createdAt: new Date("2024-01-01T12:00:00Z").toISOString(),
        updatedAt: new Date("2024-01-02T12:00:00Z").toISOString(),
        folder: "Samples",
        html: "<h1>Hello</h1><p>This is a sample <strong>note</strong>.</p>",
      },
    ];
    rawJson = JSON.stringify(sample);
    console.warn(
      "JXA execution failed; proceeding with dummy data because --allow-dummy was provided."
    );
  }

  let rawNotes: RawNote[];
  let jxaMeta: Record<string, unknown> | undefined;
  try {
    if (verbose) console.log("[visual-notes-ingest] Parsing JSON from JXA...");
    const parsed: JxaResult = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      rawNotes = parsed;
    } else {
      rawNotes = parsed?.notes ?? [];
      jxaMeta =
        parsed && typeof parsed === "object" ? (parsed as any) : undefined;
    }
  } catch (e) {
    throw new Error(
      "Could not parse JXA JSON output. Ensure permissions are granted for Notes."
    );
  }

  if (verbose && jxaMeta) {
    const wrote = (jxaMeta as any).wrote;
    const skipped = (jxaMeta as any).skipped;
    const outDirMeta = (jxaMeta as any).outDir;
    const inline = (jxaMeta as any).inline;
    if (typeof wrote !== "undefined" || typeof skipped !== "undefined") {
      console.log(
        `[visual-notes-ingest] JXA summary: wrote=${wrote ?? "?"} skipped=${
          skipped ?? "?"
        } inline=${inline ? "yes" : "no"} outDir=${outDirMeta ?? "(none)"}`
      );
    }
    const debug = (jxaMeta as any).debug;
    if (Array.isArray(debug) && debug.length > 0) {
      for (const line of debug) {
        console.log(`[visual-notes-ingest][JXA] ${String(line)}`);
      }
    }
  }

  // Safety: slice to limit in case JXA ignored it
  if (limit > 0 && rawNotes.length > limit) {
    rawNotes = rawNotes.slice(0, limit);
  }

  // Markdown conversion is opt-in
  const markdown = process.argv.includes("--markdown");
  // Posting to server is opt-in
  const postToServer = process.argv.includes("--post");
  let serverUrl = process.env.SERVER_URL || "http://localhost:3000";
  const serverUrlIndex = process.argv.findIndex((a) => a === "--server-url");
  if (serverUrlIndex !== -1) {
    const val = process.argv[serverUrlIndex + 1];
    if (val) serverUrl = val;
  }
  if (markdown) {
    const TurndownService = (await import("turndown")).default;
    const turndown = new TurndownService();

    if (verbose)
      console.log(
        `[visual-notes-ingest] Converting ${rawNotes.length} notes to Markdown...`
      );
    const exported: ExportedNote[] = rawNotes.map((n, idx) => {
      if (verbose) {
        const title = n.title || "(untitled)";
        console.log(
          `[visual-notes-ingest] [${idx + 1}/${
            rawNotes.length
          }] Converting: ${title}`
        );
      }
      let htmlSource = n.html || "";
      if (!htmlSource && n.filePath) {
        try {
          if (existsSync(n.filePath)) {
            if (verbose)
              console.log(
                `[visual-notes-ingest] Reading HTML from file: ${n.filePath}`
              );
            htmlSource = readFileSync(n.filePath, "utf8");
          } else if (verbose) {
            console.warn(
              `[visual-notes-ingest] HTML file not found: ${n.filePath}`
            );
          }
        } catch (e) {
          console.warn(
            `[visual-notes-ingest] Failed to read HTML file ${n.filePath}: ${
              (e as Error).message
            }`
          );
        }
      }
      return {
        id: n.id,
        title: n.title,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        folder: n.folder,
        markdown: turndown.turndown(htmlSource),
      };
    });

    const notesJsonPath = join(outDir, "notes.json");
    if (verbose)
      console.log(`[visual-notes-ingest] Writing JSON to ${notesJsonPath}...`);
    writeFileSync(
      notesJsonPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          noteCount: exported.length,
          notes: exported,
        },
        null,
        2
      )
    );

    if (split) {
      mkdirSync(splitDir, { recursive: true });
      const indexWidth = String(exported.length).length;
      for (let i = 0; i < exported.length; i++) {
        const n = exported[i];
        const idxStr = String(i + 1).padStart(indexWidth, "0");
        const base = sanitizeFilename(n.title || "note", n.id);
        const filepath = join(splitDir, `${idxStr}-${base}.md`);
        if (verbose) console.log(`[visual-notes-ingest] Writing ${filepath}`);
        writeFileSync(filepath, n.markdown);
      }
    }

    console.log(`Wrote ${exported.length} notes to ${notesJsonPath}`);

    // Optionally POST each markdown note to the server
    if (postToServer) {
      const endpoint = serverUrl.replace(/\/?$/, "") + "/api/docs";
      if (verbose) {
        console.log(
          `[visual-notes-ingest] Posting ${exported.length} notes to ${endpoint}...`
        );
      }
      const fetchFn = (globalThis as any).fetch as
        | ((input: string, init?: any) => Promise<any>)
        | undefined;
      if (!fetchFn) {
        console.error(
          "[visual-notes-ingest] No global fetch available. Use Node 18+ or set a fetch polyfill."
        );
      } else {
        let successes = 0;
        let failures = 0;
        for (let i = 0; i < exported.length; i++) {
          const note = exported[i];
          const title = note.title || "(untitled)";
          try {
            if (verbose)
              console.log(
                `[visual-notes-ingest] [${i + 1}/${
                  exported.length
                }] POST ${title}`
              );
            const res = await fetchFn(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, markdown: note.markdown }),
            });
            const json: any = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
            successes++;
            if (verbose)
              console.log(
                `[visual-notes-ingest]    -> success id=${json?.id ?? "?"}`
              );
          } catch (e) {
            failures++;
            console.error(
              `[visual-notes-ingest]    -> failed: ${(e as Error).message}`
            );
          }
        }
        console.log(
          `[visual-notes-ingest] Upload complete: success=${successes} failed=${failures}`
        );
      }
    } else if (verbose) {
      console.log(
        `[visual-notes-ingest] Skipping POST (enable with --post, server via --server-url or SERVER_URL)`
      );
    }
  } else {
    // Raw mode: write index with metadata + file paths only
    const rawIndexPath = join(outDir, "raw-index.json");
    if (verbose)
      console.log(
        `[visual-notes-ingest] Writing raw index to ${rawIndexPath}...`
      );
    const index = rawNotes.map((n) => ({
      id: n.id,
      title: n.title,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      folder: n.folder,
      filePath: n.filePath || null,
      hasHtmlInline: typeof n.html === "string" && n.html.length > 0,
    }));
    writeFileSync(
      rawIndexPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          noteCount: index.length,
          notes: index,
          htmlOutDir: jxaRawDir,
        },
        null,
        2
      )
    );
    console.log(`Wrote raw index for ${index.length} notes to ${rawIndexPath}`);
  }
}

function sanitizeFilename(title: string, id: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const trimmed = ascii.slice(0, 64) || id.slice(0, 12);
  return trimmed;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
