// Smoke for live note updates: an MCP write must reach an open /ws/notes socket.
//
//   APP_URL=http://127.0.0.1:3141 AUTH_SECRET=<secret> MCP_BEARER=<dev token> \
//   node --experimental-strip-types scripts/note-live-smoke.ts
//
// Checks that a socket without the magic-session cookie is refused, then opens
// an authenticated socket, creates one note under `note-live-smoke.<ts>`
// through MCP (or appends to NOTE_APPEND_ID), and waits for its
// notes:changed event. Run it only against a
// local or disposable database.
import { createHmac } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const appUrl = process.env.APP_URL;
const authSecret = process.env.AUTH_SECRET;
const bearer = process.env.MCP_BEARER;
if (!appUrl || !authSecret || !bearer) {
  console.error(
    "[note-live-smoke] APP_URL, AUTH_SECRET and MCP_BEARER are required",
  );
  process.exit(2);
}

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

// Same shape as issueMagicToken in src/server/magic-auth.ts.
function magicCookie(): string {
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ ok: true, iat: now, exp: now + 600 }),
  )}`;
  const sig = b64url(createHmac("sha256", authSecret!).update(data).digest());
  return `magic_auth=${data}.${sig}`;
}

function check(condition: unknown, message: string): void {
  console.info(`[note-live-smoke] ${condition ? "PASS" : "FAIL"} ${message}`);
  if (!condition) process.exitCode = 1;
}

const socketUrl = new URL("/ws/notes", appUrl)
  .toString()
  .replace(/^http/, "ws");

function openSocket(headers?: Record<string, string>) {
  // Node's WebSocket accepts a non-standard `headers` option for the upgrade.
  const Ctor = WebSocket as unknown as new (
    url: string,
    opts?: { headers?: Record<string, string> },
  ) => WebSocket;
  return new Ctor(socketUrl, headers ? { headers } : undefined);
}

function settle(ws: WebSocket): Promise<"open" | "closed"> {
  return new Promise((resolve) => {
    ws.addEventListener("open", () => resolve("open"));
    ws.addEventListener("close", () => resolve("closed"));
    ws.addEventListener("error", () => resolve("closed"));
  });
}

const anon = openSocket();
const anonState = await settle(anon);
// The server may accept the upgrade and close right away; give it a moment.
const anonStillOpen =
  anonState === "open" &&
  (await new Promise<boolean>((r) => {
    anon.addEventListener("close", () => r(false));
    setTimeout(() => r(anon.readyState === WebSocket.OPEN), 500);
  }));
check(!anonStillOpen, "socket without the session cookie is refused");
anon.close();

const ws = openSocket({ Cookie: magicCookie() });
check((await settle(ws)) === "open", "socket with the session cookie opens");

const events: { type: string; changes: { id: string }[] | null }[] = [];
ws.addEventListener("message", (event) => {
  events.push(JSON.parse(String(event.data)));
});

const client = new Client({ name: "note-live-smoke", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("/mcp", appUrl), {
    requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
  }),
);
// NOTE_APPEND_ID appends to an existing ChatGPT note instead of creating one,
// which is handy with that note open in a browser tab.
const appendId = process.env.NOTE_APPEND_ID;
const result = (await client.callTool(
  appendId
    ? {
        name: "append_to_note",
        arguments: {
          id: appendId,
          markdown:
            process.env.NOTE_MARKDOWN ??
            `Appended by scripts/note-live-smoke.ts at ${new Date().toISOString()}`,
        },
      }
    : {
        name: "create_note",
        arguments: {
          title: process.env.NOTE_TITLE ?? "Live smoke note",
          path: `note-live-smoke.${Date.now()}`,
          markdown: "Created by scripts/note-live-smoke.ts",
        },
      },
)) as { isError?: boolean; structuredContent?: { id?: string } };
const id = appendId ?? result.structuredContent?.id;
check(
  !result.isError && id,
  `MCP ${appendId ? "append_to_note" : "create_note"} succeeds`,
);

const deadline = Date.now() + 3000;
while (
  Date.now() < deadline &&
  !events.some((e) => e.changes?.some((c) => c.id === id))
) {
  await new Promise((r) => setTimeout(r, 50));
}
check(
  events.some(
    (e) => e.type === "notes:changed" && e.changes?.some((c) => c.id === id),
  ),
  "notes:changed for the note arrives within 3s",
);
console.info("[note-live-smoke] note", { id });

ws.close();
await client.close();
