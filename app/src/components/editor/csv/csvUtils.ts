import type { JSONContent } from "@tiptap/core";

export function parseDelimited(
  text: string,
  delimiterHint?: "," | "\t"
): string[][] {
  const trimmed = text.replace(/\r\n?/g, "\n");
  const hasTab = /\t/.test(trimmed);
  const hasComma = /,/.test(trimmed);
  const delimiter = delimiterHint ?? (hasTab && !hasComma ? "\t" : ",");

  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = trimmed[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) {
        current.push(field);
        field = "";
      } else if (ch === "\n") {
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  rows.push(current);

  if (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (last.every((c) => c === "")) rows.pop();
  }
  return rows;
}

type Delim = "," | "\t";

function analyzeConsistency(text: string, delim: Delim) {
  const rows = parseDelimited(text, delim);
  const totalRows = rows.length;
  let nonEmptyRows = 0;
  const colCounts: number[] = [];
  for (const r of rows) {
    const isBlank = r.every((c) => (c ?? "").trim() === "");
    if (!isBlank) {
      nonEmptyRows++;
      colCounts.push(r.length);
    }
  }
  // Require at least 5 non-empty rows of data
  if (nonEmptyRows < 5) {
    return {
      ok: false as const,
      delim,
      totalRows,
      nonEmptyRows,
      modeCols: 0,
      mismatches: totalRows,
    };
  }
  // Compute modal column count among non-empty rows
  const freq = new Map<number, number>();
  for (const n of colCounts) freq.set(n, (freq.get(n) ?? 0) + 1);
  let modeCols = 0;
  let modeCount = -1;
  for (const [n, f] of freq) {
    if (f > modeCount) {
      modeCount = f;
      modeCols = n;
    }
  }
  // Count mismatches across ALL rows. Blank rows count as mismatches.
  let mismatches = 0;
  for (const r of rows) {
    const isBlank = r.every((c) => (c ?? "").trim() === "");
    if (isBlank) {
      mismatches++;
      continue;
    }
    if (r.length !== modeCols) mismatches++;
  }
  const allowed = totalRows < 10 ? 1 : Math.floor(totalRows * 0.1);
  const ok = mismatches <= allowed;
  return { ok, delim, totalRows, nonEmptyRows, modeCols, mismatches };
}

function detectDelimiter(text: string): Delim | null {
  const sample = text; // Use full text; callers may pass trimmed sample if desired
  const hasNewline = /\n/.test(sample);
  if (!hasNewline) return null;
  const candidates: Delim[] = [",", "\t"];
  const results = candidates.map((d) => analyzeConsistency(sample, d));
  const passing = results.filter((r) => r.ok);
  if (passing.length === 0) return null;
  // Choose the one with fewer mismatches; tie-break on larger modeCols, then prefer tab.
  passing.sort((a, b) => {
    if (a.mismatches !== b.mismatches) return a.mismatches - b.mismatches;
    if (a.modeCols !== b.modeCols) return b.modeCols - a.modeCols;
    if (a.delim === "\t" && b.delim === ",") return -1;
    if (a.delim === "," && b.delim === "\t") return 1;
    return 0;
  });
  return passing[0].delim;
}

export function isProbablyCSV(text: string): boolean {
  const sample = text.slice(0, 8000);
  const detected = detectDelimiter(sample);
  return detected !== null;
}

export function csvTextToTableJson(text: string): JSONContent {
  const delim = detectDelimiter(text) ?? undefined;
  const rows = parseDelimited(text, delim);
  const numCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

  const body: JSONContent[] = rows.map((r, idx) => {
    const isHeader = idx === 0;
    const cells: JSONContent[] = Array.from({ length: numCols }, (_, c) => {
      const raw = r[c] ?? "";
      return {
        type: isHeader ? "tableHeader" : "tableCell",
        content: [
          {
            type: "paragraph",
            content: raw ? [{ type: "text", text: raw }] : [],
          },
        ],
      };
    });
    return { type: "tableRow", content: cells };
  });

  const table: JSONContent = { type: "table", content: body };
  return table;
}
