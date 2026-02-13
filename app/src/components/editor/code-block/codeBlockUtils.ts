export const CODE_BLOCK_COLLAPSED_HEIGHT = 240;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  yml: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  plaintext: "text",
  txt: "text",
  md: "markdown",
};

const EXTENSION_MAP: Record<string, string> = {
  bash: "sh",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  css: "css",
  diff: "diff",
  dockerfile: "Dockerfile",
  go: "go",
  html: "html",
  ini: "ini",
  java: "java",
  javascript: "js",
  json: "json",
  jsx: "jsx",
  kotlin: "kt",
  lua: "lua",
  makefile: "Makefile",
  markdown: "md",
  mermaid: "mmd",
  php: "php",
  python: "py",
  ruby: "rb",
  rust: "rs",
  scss: "scss",
  sql: "sql",
  swift: "swift",
  text: "txt",
  toml: "toml",
  tsx: "tsx",
  typescript: "ts",
  xml: "xml",
  yaml: "yaml",
};

export function parseLanguageFromClassName(className: string | undefined): string {
  if (!className) return "text";
  const match = /(?:^|\s)language-([\w-]+)(?:\s|$)/.exec(className);
  return normalizeLanguage(match?.[1] ?? "text");
}

export function normalizeLanguage(language: string | undefined): string {
  if (!language) return "text";
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "text";
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

export function resolveCodeLanguage(
  preferredLanguage: string | undefined,
  className: string | undefined,
): string {
  if (preferredLanguage && preferredLanguage.trim().length > 0) {
    return normalizeLanguage(preferredLanguage);
  }
  return parseLanguageFromClassName(className);
}

export function normalizeRawCodeForRender(rawCode: string): string {
  const normalizedLineEndings = rawCode.replace(/\r\n?/g, "\n");
  if (normalizedLineEndings.endsWith("\n")) {
    return normalizedLineEndings.slice(0, -1);
  }
  return normalizedLineEndings;
}

export function splitCodeLines(code: string): string[] {
  if (code.length === 0) return [""];
  return code.split("\n");
}

export function getLineDigits(lineCount: number): number {
  return String(Math.max(1, lineCount)).length;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function extensionForLanguage(language: string): string {
  const normalized = normalizeLanguage(language);
  return EXTENSION_MAP[normalized] ?? "txt";
}
