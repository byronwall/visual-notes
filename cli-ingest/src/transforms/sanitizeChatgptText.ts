const PUA_OPEN = "\uE200"; // 
const PUA_CLOSE = "\uE201"; // 
const PUA_SEP = "\uE202"; // 

function removeCitePlaceholders(input: string): string {
  if (!input) return input;
  // Remove any cite... blocks (or using explicit \uE200/1/2 forms)
  const citePattern = new RegExp(
    `${PUA_OPEN}\\s*cite\\s*(?:${PUA_SEP}[\\s\\S]*?)?${PUA_CLOSE}`,
    "g"
  );
  return input.replace(citePattern, "");
}

function replaceEntityPlaceholders(input: string): string {
  if (!input) return input;
  // Replace entity block with the second quoted label (e.g., "umap-learn")
  const entityBlock = new RegExp(
    `${PUA_OPEN}\\s*entity\\s*${PUA_SEP}([\\s\\S]*?)${PUA_CLOSE}`,
    "g"
  );
  return input.replace(entityBlock, (_full: string, inner: string) => {
    const decoded = decodeHtmlEntities(inner);
    const name = extractSecondQuotedString(decoded);
    return name || "";
  });
}

function extractSecondQuotedString(s: string): string {
  let inQuotes = false;
  let escape = false;
  let buf = "";
  const values: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (!inQuotes) {
      if (ch === '"') {
        inQuotes = true;
        buf = "";
      }
      continue;
    }
    // in quotes
    if (escape) {
      buf += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = false;
      values.push(buf);
      if (values.length >= 2) break;
      continue;
    }
    buf += ch;
  }

  return values[1] ?? "";
}

function stripGenericPUABlocks(input: string): string {
  if (!input) return input;
  // As a fallback, remove any remaining PUA wrapper blocks
  const generic = new RegExp(`${PUA_OPEN}[\\s\\S]*?${PUA_CLOSE}`, "g");
  const result = input.replace(generic, "");

  return result;
}

function fixUnbalancedBackticks(input: string): string {
  if (!input) return input;

  let s = input;

  // Fix unbalanced triple backtick fences across the whole string
  const fenceCount = (s.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) {
    s = s.trimEnd() + "\n```";
  }

  // Remove fenced code content temporarily when checking single backticks
  const fencedRemoved = s.replace(/```[\s\S]*?```/g, "");
  const singleCount = (fencedRemoved.match(/(?<!`)`(?!`)/g) || []).length;
  if (singleCount % 2 === 1) {
    s = s + "`";
  }
  return s;
}

function collapseWhitespace(input: string): string {
  if (!input) return input;
  // Trim and collapse 3+ newlines to at most 2 to keep spacing tidy
  return input
    .replace(/[\t\x0B\f\r ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanChatgptPlainText(raw: string): string {
  let s = raw ?? "";
  s = removeCitePlaceholders(s);
  s = replaceEntityPlaceholders(s);
  s = stripGenericPUABlocks(s);
  s = collapseWhitespace(s);
  s = fixUnbalancedBackticks(s);
  return s;
}

export function hasVisibleContent(text: string): boolean {
  if (!text) return false;
  const s = text.replace(/[`*_#>\-\s\n\r]+/g, "").trim();
  return s.length > 0;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
