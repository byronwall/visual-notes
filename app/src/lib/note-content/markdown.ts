import type { NoteDoc, NoteNode } from "./types";

/**
 * Serializes a note document to markdown. With `withIds`, each top-level
 * block and list item is tagged with its block id (` ^id`) so an AI client can
 * address it. Markdown is an interchange view only; blocks stay canonical.
 */
export type ToMarkdownOptions = { withIds?: boolean };

type Ctx = { withIds: boolean };

const idTag = (node: NoteNode, ctx: Ctx) =>
  ctx.withIds && node.attrs?.id ? ` ^${node.attrs.id}` : "";

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function applyMarks(text: string, marks: NoteNode["marks"]): string {
  if (!marks?.length) return text;
  let out = text;
  const has = (t: string) => marks.find((m) => m.type === t);
  if (has("code")) return `\`${text}\``;
  if (has("bold")) out = `**${out}**`;
  if (has("italic")) out = `*${out}*`;
  if (has("strike")) out = `~~${out}~~`;
  if (has("highlight")) out = `==${out}==`;
  const link = has("link");
  if (link?.attrs?.href) out = `[${out}](${link.attrs.href})`;
  return out;
}

export function inlineToMarkdown(nodes: NoteNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text": {
          const isCode = node.marks?.some((m) => m.type === "code");
          const raw = node.text ?? "";
          return applyMarks(isCode ? raw : escapeText(raw), node.marks);
        }
        case "hardBreak":
          return "  \n";
        case "emoji":
          return node.attrs?.name ? `:${node.attrs.name}:` : "";
        case "image":
          return `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})`;
        case "noteLink": {
          const label = node.attrs?.label || "note";
          const target = node.attrs?.blockId
            ? `${node.attrs?.docId}#${node.attrs.blockId}`
            : node.attrs?.docId;
          return `[[${label}|${target}]]`;
        }
        case "tag":
          return node.attrs?.name ? `#${node.attrs.name}` : "";
        default:
          return inlineToMarkdown(node.content);
      }
    })
    .join("");
}

const indent = (text: string, prefix: string) =>
  text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");

function listToMarkdown(node: NoteNode, ctx: Ctx): string {
  const ordered = node.type === "orderedList";
  let n = Number(node.attrs?.start ?? 1);
  return (node.content ?? [])
    .map((item) => {
      const marker = ordered ? `${n++}. ` : "- ";
      const children = item.content ?? [];
      const [first, ...rest] = children;
      const head =
        first && first.type === "paragraph"
          ? inlineToMarkdown(first.content)
          : first
            ? blockToMarkdown(first, ctx, false)
            : "";
      const tail = rest
        .map((child) => blockToMarkdown(child, ctx, false))
        .join("\n");
      const body = `${head}${idTag(item, ctx)}${tail ? "\n" + tail : ""}`;
      const pad = " ".repeat(marker.length);
      const [line0, ...more] = body.split("\n");
      return [marker + line0, ...more.map((l) => (l ? pad + l : l))].join(
        "\n",
      );
    })
    .join("\n");
}

function tableToMarkdown(node: NoteNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((p) => inlineToMarkdown(p.content))
        .join(" ")
        .replace(/\|/g, "\\|"),
    ),
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const [header, ...body] = rows;
  return [
    line(header),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map(line),
  ].join("\n");
}

/** Extra block serializers registered by feature node types. */
export const blockSerializers: Record<
  string,
  (node: NoteNode, ctx: { withIds: boolean }) => string
> = {};

function blockToMarkdown(node: NoteNode, ctx: Ctx, topLevel: boolean): string {
  const tag = idTag(node, ctx);
  const trailingIdLine = tag ? `\n^${node.attrs?.id}` : "";
  switch (node.type) {
    case "paragraph":
      return inlineToMarkdown(node.content) + tag;
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineToMarkdown(node.content)}${tag}`;
    case "bulletList":
    case "orderedList":
      return listToMarkdown(node, ctx);
    case "blockquote":
      return (
        indent(
          (node.content ?? [])
            .map((c) => blockToMarkdown(c, ctx, false))
            .join("\n\n"),
          "> ",
        ) + trailingIdLine
      );
    case "codeBlock": {
      const lang = node.attrs?.language ?? "";
      const code = (node.content ?? []).map((t) => t.text ?? "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\`${trailingIdLine}`;
    }
    case "horizontalRule":
      return `---${tag}`;
    case "image":
      return `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})${tag}`;
    case "table":
      return tableToMarkdown(node) + trailingIdLine;
    default: {
      const custom = blockSerializers[node.type];
      if (custom) return custom(node, ctx);
      if (node.content)
        return node.content
          .map((c) => blockToMarkdown(c, ctx, topLevel))
          .join("\n\n");
      return "";
    }
  }
}

export function toMarkdown(doc: NoteDoc, opts: ToMarkdownOptions = {}): string {
  const ctx: Ctx = { withIds: Boolean(opts.withIds) };
  return (doc.content ?? [])
    .map((node) => blockToMarkdown(node, ctx, true))
    .filter((chunk, i, all) => chunk !== "" || i < all.length - 1)
    .join("\n\n")
    .trim();
}

/** Plain text of one node: inline text joined, child blocks on new lines. */
export function nodeText(node: NoteNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "emoji") return node.attrs?.name ? `:${node.attrs.name}:` : "";
  if (node.type === "noteLink") return node.attrs?.label ?? "";
  if (node.type === "tag") return node.attrs?.name ? `#${node.attrs.name}` : "";
  if (node.type === "image") return node.attrs?.alt ?? "";
  const children = node.content ?? [];
  if (children.length === 0) return "";
  const inline = children.every(
    (c) =>
      c.type === "text" ||
      c.type === "hardBreak" ||
      c.type === "emoji" ||
      c.type === "noteLink" ||
      c.type === "tag",
  );
  return children.map(nodeText).join(inline ? "" : "\n");
}

export function toPlainText(doc: NoteDoc): string {
  return (doc.content ?? [])
    .map(nodeText)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Removes ` ^id` block tags an AI client may echo back. */
export function stripIdTags(markdown: string): string {
  return markdown
    .replace(/[ \t]+\^[A-Za-z0-9]{6,24}[ \t]*$/gm, "")
    .replace(/^\^[A-Za-z0-9]{6,24}[ \t]*$/gm, "");
}
