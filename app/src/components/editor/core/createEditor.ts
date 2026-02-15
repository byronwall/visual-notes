import { createTiptapEditor } from "solid-tiptap";
import type { Editor } from "@tiptap/core";
import { buildExtensions } from "../extensions/index";

// TODO:AS_ANY, ProseMirror node/fragment types are not directly exported in this workspace setup.
type PMNode = any;

function fragmentToArray(fragment: PMNode): PMNode[] {
  const out: PMNode[] = [];
  if (!fragment?.forEach) return out;
  fragment.forEach((child: PMNode) => out.push(child));
  return out;
}

function serializeInline(node: PMNode): string {
  if (!node) return "";
  if (node.type?.name === "text") return String(node.text || "");
  if (node.type?.name === "hardBreak") return "\n";
  if (!node.content) return String(node.textContent || "");
  return fragmentToArray(node.content).map(serializeInline).join("");
}

function serializeListItem(
  node: PMNode,
  indentLevel: number,
  marker: string,
  options: { fenceCodeBlocks: boolean },
): string[] {
  const indent = "  ".repeat(indentLevel);
  const childNodes = fragmentToArray(node.content);
  const textBlocks = childNodes.filter(
    (child) => child.type?.name !== "bulletList" && child.type?.name !== "orderedList",
  );
  const nestedLists = childNodes.filter(
    (child) => child.type?.name === "bulletList" || child.type?.name === "orderedList",
  );

  const firstText = textBlocks.length > 0 ? serializeInline(textBlocks[0]).trim() : "";
  const lines: string[] = [`${indent}${marker}${firstText}`];

  for (let i = 1; i < textBlocks.length; i += 1) {
    const extra = serializeInline(textBlocks[i]).trim();
    if (!extra) continue;
    lines.push(`${indent}  ${extra}`);
  }

  for (const listNode of nestedLists) {
    lines.push(...serializeBlockNode(listNode, indentLevel + 1, options));
  }

  return lines;
}

function serializeBlockNode(
  node: PMNode,
  indentLevel = 0,
  options: { fenceCodeBlocks: boolean },
): string[] {
  const type = node?.type?.name;
  if (!type) return [];

  if (type === "bulletList") {
    const out: string[] = [];
    const items = fragmentToArray(node.content);
    for (const item of items) {
      out.push(...serializeListItem(item, indentLevel, "- ", options));
    }
    return out;
  }

  if (type === "orderedList") {
    const out: string[] = [];
    const start = Number(node.attrs?.start || 1);
    const items = fragmentToArray(node.content);
    for (let i = 0; i < items.length; i += 1) {
      out.push(
        ...serializeListItem(items[i], indentLevel, `${start + i}. `, options),
      );
    }
    return out;
  }

  if (type === "listItem") {
    return serializeListItem(node, indentLevel, "- ", options);
  }

  if (type === "codeBlock") {
    const raw = String(node.textContent || "");
    if (!options.fenceCodeBlocks) {
      return raw.length > 0 ? raw.split("\n") : [""];
    }
    const language = String(node.attrs?.language || "").trim();
    const fenceHead = language ? `\`\`\`${language}` : "```";
    const body = raw.length > 0 ? raw.split("\n") : [""];
    return [fenceHead, ...body, "```"];
  }

  if (type === "paragraph" || type === "heading") {
    return [serializeInline(node).trim()];
  }

  if (type === "blockquote") {
    const inner = fragmentToArray(node.content).flatMap((child) =>
      serializeBlockNode(child, indentLevel, options),
    );
    return inner.map((line) => `> ${line}`);
  }

  return fragmentToArray(node.content).flatMap((child) =>
    serializeBlockNode(child, indentLevel, options),
  );
}

function serializeClipboardText(slice: {
  content: PMNode;
  openStart: number;
  openEnd: number;
}): string {
  const options = { fenceCodeBlocks: slice.openStart === 0 && slice.openEnd === 0 };
  const lines = fragmentToArray(slice.content).flatMap((node, index, arr) => {
    const blockLines = serializeBlockNode(node, 0, options);
    if (index < arr.length - 1 && blockLines.length > 0) {
      return [...blockLines, ""];
    }
    return blockLines;
  });
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.join("\n");
}

export function createEditor(
  element: () => HTMLElement | undefined,
  initial: string,
  onPrompt: Parameters<typeof buildExtensions>[0]
) {
  return createTiptapEditor(() => ({
    element: element()!,
    extensions: buildExtensions(onPrompt),
    editorProps: {
      attributes: { class: "prose editor-prose" },
      clipboardTextSerializer: serializeClipboardText,
    },
    content: initial,
  })) as unknown as () => Editor | null;
}

export function createEditorWithPrompts(
  element: () => HTMLElement | undefined,
  initial: string,
  onCsvPrompt: Parameters<typeof buildExtensions>[0],
  onMarkdownPrompt?: Parameters<typeof buildExtensions>[1]
) {
  return createTiptapEditor(() => ({
    element: element()!,
    extensions: buildExtensions(onCsvPrompt, onMarkdownPrompt),
    editorProps: {
      attributes: { class: "prose editor-prose" },
      clipboardTextSerializer: serializeClipboardText,
    },
    content: initial,
  })) as unknown as () => Editor | null;
}
