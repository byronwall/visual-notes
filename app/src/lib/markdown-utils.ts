import type { Element, Text } from "hast";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isHastText(node: unknown): node is Text {
  return (
    isRecord(node) && node.type === "text" && typeof node.value === "string"
  );
}

function isHastElement(node: unknown): node is Element {
  return (
    isRecord(node) &&
    typeof node.tagName === "string" &&
    Array.isArray(node.children)
  );
}

function extractTextFromNode(node: unknown): string {
  if (isHastText(node)) {
    return node.value;
  }
  if (isHastElement(node)) {
    return node.children.map(extractTextFromNode).join("");
  }
  return "";
}

/**
 * Extracts plain text from markdown code element children.
 * Handles both string children and HAST node structures.
 */
export function normalizeCodeText(children: unknown, node?: unknown): string {
  if (Array.isArray(children)) {
    const joined = children
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
    if (joined.length > 0) return joined;
  }
  if (typeof children === "string") {
    return children;
  }
  if (node) {
    return extractTextFromNode(node);
  }
  return "";
}

/**
 * Parses the programming language from a class name like "language-typescript".
 * Returns "text" if no language is found.
 */
export function parseLanguage(...values: Array<unknown>): string {
  const className = values.find((value) => typeof value === "string");
  if (typeof className !== "string") {
    return "text";
  }
  const match = /language-([\w-]+)/.exec(className);
  return match?.[1] ?? "text";
}
