import { join, basename, resolve } from "node:path";
import { statSync, readFileSync, readdirSync } from "node:fs";
import { IngestSource, IngestSourceOptions, RawNote } from "../types";
import { rewriteRelativeLinks } from "../transforms/rewriteRelativeLinks";

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

  const toSlug = (s: string, max = 64) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max);

  const renderMessagesToMarkdown = (
    messages: ConversationMessage[],
    assets: AssetIndex
  ) => {
    const lines: string[] = [];
    for (const m of messages) {
      const author = m.author ?? "Unknown";
      const ts = m.create_time
        ? new Date(m.create_time * 1000).toISOString()
        : "";
      lines.push(`\n### ${author}${ts ? ` — ${ts}` : ""}`);
      if (!m.parts?.length) {
        lines.push("");
        continue;
      }
      for (const part of m.parts) {
        if ("text" in part && typeof part.text === "string") {
          lines.push(part.text);
          continue;
        }
        if ("transcript" in part && typeof part.transcript === "string") {
          lines.push(`\n> [Transcript]\n>\n> ${part.transcript}`);
          continue;
        }
        if ("asset" in part && part.asset) {
          const pointer = (part.asset as { asset_pointer?: string })
            .asset_pointer;
          const link = pointer ? assets[pointer] : undefined;
          if (link) {
            const fileName = link.split("/").pop() ?? "file";
            if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
              lines.push(`\n![${fileName}](${link})`);
            } else {
              lines.push(`\n[File: ${fileName}](${link})`);
            }
          } else {
            lines.push(`\n[File]: -Deleted-`);
          }
        }
      }
    }
    return lines.join("\n\n").trim() + "\n";
  };

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
        const baseSlug = toSlug(convo.title || "chat");
        const convoFolder = `ChatGPT/${createdAt.slice(
          0,
          10
        )}/${baseSlug}__${convo.id.slice(0, 8)}`;

        const mdHeader = [
          `<!-- source: chatgpt-html; conversation_id: ${convo.id} -->`,
          `# ${convo.title}`,
          `*Conversation ID:* \`${convo.id}\`  `,
          `*Created:* ${createdAt}`,
          ``,
        ].join("\n");

        const mdBody = renderMessagesToMarkdown(messages, assetsJson);
        const mdFull = [mdHeader, mdBody].join("\n\n");

        const mdRewritten = rewriteRelativeLinks(mdFull);

        const fauxHtml = `<article data-origin="chatgpt-html"><h1>${escapeHtml(
          convo.title
        )}</h1>\n<pre data-md>${escapeHtml(mdRewritten)}</pre></article>`;

        const id = sanitizeId(`${convo.id}__0`);
        notes.push({
          id,
          title: convo.title,
          createdAt,
          updatedAt: createdAt,
          folder: convoFolder,
          html: fauxHtml,
        });
      }

      console.log("[chatgpt-html.load] produced notes:", notes.length);
      return { notes, meta: { root: rootOrFile, source: "chatgpt-html" } };
    },
  };
}
