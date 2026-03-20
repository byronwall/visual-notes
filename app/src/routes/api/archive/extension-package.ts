import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function buildDownloadPage(downloadHref: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Explorer Extension Download</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f5f3ef;
        color: #1e1e1b;
      }
      main {
        width: min(32rem, calc(100vw - 2rem));
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 20px;
        padding: 1.25rem;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.375rem;
      }
      p {
        margin: 0.5rem 0 0;
        line-height: 1.45;
        color: #57534e;
      }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 1rem;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        background: #111827;
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Explorer extension</h1>
      <p>Download the packaged Chrome extension and load it in developer mode from <code>chrome://extensions</code>.</p>
      <a class="button" href="${downloadHref}">Download zip</a>
    </main>
  </body>
</html>`;
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const wantsDownload = url.searchParams.get("download") === "1";

  if (!wantsDownload) {
    return new Response(buildDownloadPage("/api/archive/extension-package?download=1"), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "visual-notes-extension-"));
  const zipPath = path.join(tempDir, "visual-notes-explorer-extension.zip");
  const extensionDir =
    [
      path.resolve(process.cwd(), "extension"),
      path.resolve(process.cwd(), "..", "extension"),
    ].find((candidate) => existsSync(candidate)) ?? "";

  try {
    if (!extensionDir) {
      return new Response(buildDownloadPage("/api/archive/extension-package"), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    }

    await execFileAsync("zip", ["-r", zipPath, "."], {
      cwd: extensionDir,
    });
    const data = await readFile(zipPath);
    const body = new Uint8Array(data);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition":
          'attachment; filename="visual-notes-explorer-extension.zip"',
      },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
