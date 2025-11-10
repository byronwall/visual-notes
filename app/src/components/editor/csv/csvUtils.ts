import type { JSONContent } from "@tiptap/core";

export function parseDelimited(text: string): string[][] {
  console.log("[csv] parseDelimited inputLen:", text.length);
  const trimmed = text.replace(/\r\n?/g, "\n");
  const hasTab = /\t/.test(trimmed);
  const hasComma = /,/.test(trimmed);
  const delimiter = hasTab && !hasComma ? "\t" : ",";

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
  console.log("[csv] rows:", rows.length);
  return rows;
}

export function isProbablyCSV(text: string): boolean {
  const sample = text.slice(0, 2000);
  const hasNewline = /\n/.test(sample);
  const first = sample.split(/\n/)[0] || sample;
  const commaCount = (first.match(/,/g) || []).length;
  const tabCount = (first.match(/\t/g) || []).length;
  return hasNewline && (commaCount >= 1 || tabCount >= 1);
}

export function csvTextToTableJson(text: string): JSONContent {
  const rows = parseDelimited(text);
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
  console.log("[csv] table json cols:", numCols, "rows:", rows.length);
  return table;
}
