import {
  escapeHtml,
  getLineDigits,
  normalizeRawCodeForRender,
  resolveCodeLanguage,
  splitCodeLines,
} from "./codeBlockUtils";

export type RenderedCodeLines = {
  rawCode: string;
  normalizedCode: string;
  language: string;
  lines: string[];
  lineCount: number;
  lineDigits: number;
  highlighted: boolean;
};

const MAX_SHIKI_INPUT_CHARS = 12000;
const highlightedCache = new Map<string, string[]>();

export function createPlainRenderedCode(
  rawCode: string,
  language: string,
): RenderedCodeLines {
  const normalizedCode = normalizeRawCodeForRender(rawCode);
  const lines = splitCodeLines(normalizedCode).map((line) => escapeHtml(line));
  return {
    rawCode,
    normalizedCode,
    language,
    lines,
    lineCount: lines.length,
    lineDigits: getLineDigits(lines.length),
    highlighted: false,
  };
}

function extractLineHtmlFromShiki(html: string, expectedCount: number): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lineNodes = Array.from(doc.querySelectorAll("code > span.line"));

  if (lineNodes.length > 0) {
    const lines = lineNodes.map((lineNode) => lineNode.innerHTML || " ");
    if (lines.length < expectedCount) {
      for (let i = lines.length; i < expectedCount; i += 1) {
        lines.push(" ");
      }
    }
    return lines;
  }

  const codeNode = doc.querySelector("code");
  if (!codeNode) return [];

  const normalizedHtml = codeNode.innerHTML.replace(/\r\n?/g, "\n");
  return normalizedHtml.split("\n").map((line) => line || " ");
}

export async function renderCodeLines(args: {
  rawCode: string;
  dataMdLanguage?: string;
  className?: string;
}): Promise<RenderedCodeLines> {
  const language = resolveCodeLanguage(args.dataMdLanguage, args.className);
  const plain = createPlainRenderedCode(args.rawCode, language);
  const cacheKey = `${language}\u0000${plain.normalizedCode}`;

  if (language === "mermaid") {
    return plain;
  }
  if (plain.normalizedCode.length > MAX_SHIKI_INPUT_CHARS) {
    return plain;
  }
  const cachedLines = highlightedCache.get(cacheKey);
  if (cachedLines) {
    return {
      ...plain,
      lines: cachedLines,
      highlighted: true,
    };
  }

  try {
    const shiki = await import("shiki");
    const highlighted = await shiki.codeToHtml(plain.normalizedCode, {
      lang: language,
      theme: "github-light",
    });
    const highlightedLines = extractLineHtmlFromShiki(
      highlighted,
      plain.lineCount,
    );

    if (highlightedLines.length === plain.lineCount) {
      highlightedCache.set(cacheKey, highlightedLines);
      return {
        ...plain,
        lines: highlightedLines,
        highlighted: true,
      };
    }
  } catch {
    return plain;
  }

  return plain;
}
