import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  cleanChatgptPlainText,
  hasVisibleContent,
} from "../transforms/sanitizeChatgptText";
import { IngestSource, IngestSourceOptions, RawNote } from "../types";

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>\"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!)
  );

export function sanitizeId(id: string) {
  if (id.startsWith("/")) id = id.slice(1);
  return id.replace(/\//g, "__");
}

type ChatMessage = {
  id: string;
  author: { role: string };
  create_time?: number;
  content: {
    content_type: "text" | "multimodal_text" | string;
    parts: any[];
  };
  metadata?: Record<string, any>;
};

type ChatNode = {
  id: string;
  parent?: string | null;
  message?: ChatMessage;
  children?: string[];
};

type ChatExport = {
  id: string;
  title: string;
  create_time?: number;
  current_node: string;
  mapping: Record<string, ChatNode>;
};

type AssetIndex = Record<string, string>;

type MessagePart =
  | { text: string }
  | { transcript: string }
  | { asset: { asset_pointer?: string } | Record<string, unknown> };

type ConversationMessage = {
  author: string;
  parts: MessagePart[];
  create_time?: number;
  message_id: string;
};

export function chatgptHtmlSource(rootOrFile: string): IngestSource {
  const findChatHtml = (p: string): string | null => {
    const st = statSync(p);
    if (st.isFile() && basename(p).toLowerCase() === "chat.html") return p;
    if (st.isFile()) return null;
    for (const name of readdirSync(p)) {
      const child = join(p, name);
      const cst = statSync(child);
      if (cst.isDirectory()) {
        const nested = findChatHtml(child);
        if (nested) return nested;
      } else if (cst.isFile() && name.toLowerCase() === "chat.html") {
        return child;
      }
    }
    return null;
  };

  const extractJsonVar = (html: string, varName: string): any | null => {
    const idx = html.indexOf(`var ${varName}`);
    if (idx === -1) return null;
    const eq = html.indexOf("=", idx);
    if (eq === -1) return null;
    // Find first non-space char after '='
    let i = eq + 1;
    while (i < html.length && /\s/.test(html[i]!)) i++;
    const startChar = html[i];
    if (startChar !== "[" && startChar !== "{") return null;
    const open = startChar;
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inString: '"' | "'" | null = null;
    let escape = false;
    let j = i;
    for (; j < html.length; j++) {
      const ch = html[j]!;
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (ch === "\\") {
          escape = true;
        } else if (ch === inString) {
          inString = null;
        }
        continue;
      } else {
        if (ch === '"' || ch === "'") {
          inString = ch as '"' | "'";
          continue;
        }
        if (ch === open) depth++;
        else if (ch === close) {
          depth--;
          if (depth === 0) {
            j++; // include closing bracket
            break;
          }
        }
      }
    }
    const jsonText = html.slice(i, j);
    try {
      return JSON.parse(jsonText);
    } catch (err) {
      console.error(
        `[chatgpt-html.extractJsonVar] Failed to parse ${varName}:`,
        (err as Error).message
      );
      return null;
    }
  };

  const toIso = (unixSeconds?: number) =>
    unixSeconds
      ? new Date(unixSeconds * 1000).toISOString()
      : new Date(0).toISOString();

  const renderMessagesToMarkdown = (
    messages: ConversationMessage[],
    assets: AssetIndex,
    assetsBaseDir: string
  ) => {
    const lines: string[] = [];
    for (const m of messages) {
      const contentLines: string[] = [];
      for (const part of m.parts ?? []) {
        if ("text" in part && typeof part.text === "string") {
          const cleaned = cleanChatgptPlainText(part.text);
          if (hasVisibleContent(cleaned)) contentLines.push(cleaned);
          continue;
        }
        if ("transcript" in part && typeof part.transcript === "string") {
          const cleaned = cleanChatgptPlainText(part.transcript);
          if (hasVisibleContent(cleaned))
            contentLines.push(`\n> [Transcript]\n>\n> ${cleaned}`);
          continue;
        }
        if ("asset" in part && part.asset) {
          const pointer = (part.asset as { asset_pointer?: string })
            .asset_pointer;
          const link = pointer ? assets[pointer] : undefined;
          if (link) {
            const fileName = link.split("/").pop() ?? "file";
            if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
              const inlined = inlineImageIfExists(link, assetsBaseDir);
              if (!inlined) {
                console.log(
                  `[chatgpt-html] image not inlined, leaving as relative: link="${link}" baseDir="${assetsBaseDir}"`
                );
              } else {
                console.log(
                  `[chatgpt-html] image inlined from relative path: link="${link}" baseDir="${assetsBaseDir}"`
                );
              }

              contentLines.push(`\n![${fileName}](${inlined ?? link})`);
              // throw new Error("stop");
            } else {
              contentLines.push(`\n[File: ${fileName}](${link})`);
            }
          } else {
            contentLines.push(`\n[File]: -Deleted-`);
          }
        }
      }
      if (contentLines.length === 0) continue; // skip empty messages entirely

      const author = m.author ?? "Unknown";
      const ts = m.create_time
        ? new Date(m.create_time * 1000).toISOString()
        : "";
      lines.push(`\n### ${author}${ts ? ` — ${ts}` : ""}`);
      lines.push(...contentLines);
    }
    return lines.join("\n\n").trim() + "\n";
  };

  function isAbsoluteLike(p: string): boolean {
    const lower = p.toLowerCase();
    return (
      lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("data:") ||
      lower.startsWith("file:") ||
      lower.startsWith("blob:") ||
      p.startsWith("/")
    );
  }

  function isDirectory(path: string): boolean {
    try {
      const st = statSync(path);
      return st.isDirectory();
    } catch (_) {
      return false;
    }
  }

  function resolveAssetsBaseDir(startDir: string, assets: AssetIndex): string {
    // Collect first path segments from relative asset links (e.g., "dalle-generations")
    const segments = new Set<string>();
    for (const link of Object.values(assets)) {
      if (!link || typeof link !== "string") continue;
      if (isAbsoluteLike(link)) continue;
      const first = link.split("/")[0] || "";
      if (first) segments.add(first);
    }

    if (segments.size === 0) {
      console.log(
        `[chatgpt-html] assets: no relative segments detected; using startDir="${startDir}"`
      );
      return startDir;
    }

    // Try startDir and up to two parent directories for any matching segment directory
    const segList = Array.from(segments);
    let cur = startDir;
    for (let depth = 0; depth < 3; depth++) {
      for (const seg of segList) {
        const candidateDir = join(cur, seg);
        if (isDirectory(candidateDir)) {
          if (cur !== startDir) {
            console.log(
              `[chatgpt-html] resolved assets baseDir="${cur}" via segment="${seg}" (start="${startDir}")`
            );
          } else {
            console.log(
              `[chatgpt-html] assets baseDir confirmed: "${cur}" (segment="${seg}")`
            );
          }
          return cur;
        }
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }

    console.log(
      `[chatgpt-html] assets baseDir unresolved; falling back to startDir="${startDir}" segments=[${segList.join(
        ", "
      )}]]`
    );
    return startDir;
  }

  function inlineImageIfExists(
    relOrAbsPath: string,
    baseDir: string
  ): string | null {
    const lower = relOrAbsPath.toLowerCase();
    const isAbsolute =
      lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("data:") ||
      lower.startsWith("file:") ||
      lower.startsWith("blob:") ||
      relOrAbsPath.startsWith("/");
    if (isAbsolute) return null;
    let fsPath = relOrAbsPath;
    try {
      fsPath = decodeURIComponent(relOrAbsPath);
    } catch (_) {}
    const joined = join(baseDir, fsPath);
    try {
      const st = statSync(joined);
      if (!st.isFile()) {
        console.log(
          `[chatgpt-html] asset path not a file: rel="${relOrAbsPath}" -> joined="${joined}" baseDir="${baseDir}"`
        );
        return null;
      }
      const buf = readFileSync(joined);
      const mime = guessMimeType(joined);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch (e) {
      console.log(
        `[chatgpt-html] asset missing: rel="${relOrAbsPath}" -> joined="${joined}" baseDir="${baseDir}" error="${
          e instanceof Error ? e.message : String(e)
        }"`
      );
      return null;
    }
  }

  function guessMimeType(pathOrName: string): string {
    const idx = pathOrName.lastIndexOf(".");
    const ext = idx >= 0 ? pathOrName.slice(idx).toLowerCase() : "";
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      case ".svg":
        return "image/svg+xml";
      case ".bmp":
        return "image/bmp";
      case ".tiff":
      case ".tif":
        return "image/tiff";
      default:
        return "application/octet-stream";
    }
  }

  const getConversationMessages = (
    conversation: ChatExport
  ): ConversationMessage[] => {
    const out: ConversationMessage[] = [];
    let current: string | null = (conversation as any).current_node ?? null;
    if (!current || !(current in conversation.mapping)) {
      // Fallback: find a leaf node (no children) with a message
      let leaf: string | null = null;
      for (const [id, node] of Object.entries(conversation.mapping)) {
        const hasChildren =
          Array.isArray(node.children) && node.children.length > 0;
        if (!hasChildren && node.message) {
          leaf = id;
        }
      }
      current = leaf;
    }
    const guard = new Set<string>();
    while (current) {
      if (guard.has(current)) break;
      guard.add(current);

      const key = current as string;
      const node: ChatNode | undefined = conversation.mapping[key];
      if (!node) break;

      const msg = node.message;
      const meta = msg?.metadata ?? {};
      const isUserSystem = Boolean(meta.is_user_system_message);

      if (
        msg &&
        msg.content &&
        Array.isArray(msg.content.parts) &&
        (msg.author.role !== "system" || isUserSystem)
      ) {
        let author = msg.author.role;
        if (author === "assistant" || author === "tool") author = "ChatGPT";
        else if (author === "system" && isUserSystem)
          author = "Custom user info";

        const parts: MessagePart[] = [];
        for (const p of msg.content.parts) {
          if (typeof p === "string" && p.length > 0) {
            parts.push({ text: p });
          } else if (p?.content_type === "audio_transcription") {
            parts.push({ transcript: p.text });
          } else if (
            p?.content_type === "audio_asset_pointer" ||
            p?.content_type === "image_asset_pointer" ||
            p?.content_type === "video_container_asset_pointer"
          ) {
            parts.push({ asset: p });
          } else if (
            p?.content_type === "real_time_user_audio_video_asset_pointer"
          ) {
            if (p.audio_asset_pointer)
              parts.push({ asset: p.audio_asset_pointer });
            if (p.video_container_asset_pointer)
              parts.push({ asset: p.video_container_asset_pointer });
            for (const f of p.frames_asset_pointers ?? [])
              parts.push({ asset: f });
          }
        }

        out.push({
          author,
          parts,
          create_time: msg.create_time,
          message_id: msg.id,
        });
      }
      current = node.parent || null;
    }
    return out.reverse();
  };

  return {
    name: "chatgpt-html",
    async load({}: IngestSourceOptions) {
      const file = findChatHtml(resolve(rootOrFile));
      if (!file) {
        console.log(
          "[chatgpt-html.load] chat.html not found under:",
          rootOrFile
        );
        return { notes: [], meta: { root: rootOrFile } };
      }

      console.log("[chatgpt-html.load] reading file:", file);
      const html = readFileSync(file, "utf8");

      const jsonData = extractJsonVar(html, "jsonData") as ChatExport[] | null;
      const assetsJson =
        (extractJsonVar(html, "assetsJson") as AssetIndex | null) ?? {};

      if (!jsonData || !Array.isArray(jsonData)) {
        console.warn("[chatgpt-html.load] No jsonData array found; aborting.");
        return { notes: [], meta: { root: rootOrFile } };
      }

      const notes: RawNote[] = [];

      for (const convo of jsonData) {
        const messages = getConversationMessages(convo);
        console.log(
          `[chatgpt-html] convo "${convo.title}" (${convo.id}) messages:`,
          messages.length
        );

        const createdAt = toIso(convo.create_time);

        const mdHeader = [
          `# ${convo.title}`,
          `*Link back:* <https://chatgpt.com/c/${convo.id}>`,
          ``,
        ].join("\n");

        const assetsBaseDir = resolveAssetsBaseDir(dirname(file), assetsJson);
        const mdBody = renderMessagesToMarkdown(
          messages,
          assetsJson,
          assetsBaseDir
        );
        const mdFull = [mdHeader, mdBody].join("\n\n");

        // Do not rewrite relative links for ChatGPT; images will be inlined later using the source directory
        const fauxHtml = `<article data-origin="chatgpt-html"><h1>${escapeHtml(
          convo.title
        )}</h1>\n<pre data-md>${escapeHtml(mdFull)}</pre></article>`;

        const id = sanitizeId(`${convo.id}__0`);
        notes.push({
          id,
          title: convo.title,
          createdAt,
          updatedAt: createdAt,
          folder: assetsBaseDir,
          html: fauxHtml,
        });
      }

      console.log("[chatgpt-html.load] produced notes:", notes.length);
      return { notes, meta: { root: rootOrFile, source: "chatgpt-html" } };
    },
  };
}
