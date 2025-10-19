import type { Section } from "./preprocess";

export type ChunkerMode = "structure" | "sliding";

export type ChunkerConfig =
  | {
      CHUNKER_MODE?: "structure";
      CHUNK_MIN_MAX_TOKENS?: { min: number; max: number };
    }
  | {
      CHUNKER_MODE: "sliding";
      CHUNK_MIN_MAX_TOKENS?: { size: number; overlap: number };
    };

export type Chunk = Section & {
  orderIndex: number;
  charCount: number;
  tokenCount?: number;
};

function estimateTokens(s: string): number {
  // Rough estimate ~4 chars per token
  return Math.max(1, Math.round(s.length / 4));
}

function chunkStructure(
  sections: Section[],
  cfg: { min: number; max: number }
): Chunk[] {
  const out: Chunk[] = [];
  let bufferText = "";
  let bufferPath: string[] = [];
  let order = 0;

  function flush() {
    const t = bufferText.trim();
    if (!t) return;
    out.push({
      headingPath: bufferPath,
      text: t,
      orderIndex: order++,
      charCount: t.length,
      tokenCount: estimateTokens(t),
    });
    bufferText = "";
  }

  for (const sec of sections) {
    const secTokens = estimateTokens(sec.text);
    if (!bufferText) bufferPath = sec.headingPath;
    if (secTokens >= cfg.min && secTokens <= cfg.max) {
      flush();
      out.push({
        headingPath: sec.headingPath,
        text: sec.text,
        orderIndex: order++,
        charCount: sec.text.length,
        tokenCount: secTokens,
      });
      continue;
    }
    const parts = sec.text.split(/\n\n+/);
    for (const p of parts) {
      const next = (bufferText ? bufferText + "\n\n" : "") + p;
      const tokens = estimateTokens(next);
      if (tokens > cfg.max && bufferText) {
        flush();
        bufferPath = sec.headingPath;
        bufferText = p;
      } else {
        bufferText = next;
      }
      if (estimateTokens(bufferText) >= cfg.min) {
        flush();
      }
    }
  }
  flush();
  return out;
}

function chunkSliding(
  fullText: string,
  cfg: { size: number; overlap: number },
  basePath: string[]
): Chunk[] {
  const out: Chunk[] = [];
  const size = Math.max(32, cfg.size);
  const overlap = Math.max(0, Math.min(Math.floor(size / 2), cfg.overlap));
  let start = 0;
  let order = 0;
  while (start < fullText.length) {
    const end = Math.min(fullText.length, start + size * 4); // 4 chars/token heuristic
    const text = fullText.slice(start, end).trim();
    if (!text) break;
    out.push({
      headingPath: basePath,
      text,
      orderIndex: order++,
      charCount: text.length,
      tokenCount: estimateTokens(text),
    });
    if (end === fullText.length) break;
    start = end - overlap * 4;
    if (start <= 0) start = end; // avoid infinite loop
  }
  return out;
}

export function makeChunks(
  sections: Section[],
  config?: ChunkerConfig
): Chunk[] {
  const mode = config?.CHUNKER_MODE || "structure";
  if (mode === "sliding") {
    const joined = sections.map((s) => s.text).join("\n\n");
    const basePath = sections[0]?.headingPath?.slice(0, 3) || [];
    const size = (config as any)?.CHUNK_MIN_MAX_TOKENS?.size ?? 384;
    const overlap = (config as any)?.CHUNK_MIN_MAX_TOKENS?.overlap ?? 48;
    return chunkSliding(joined, { size, overlap }, basePath);
  }
  const min = (config as any)?.CHUNK_MIN_MAX_TOKENS?.min ?? 100;
  const max = (config as any)?.CHUNK_MIN_MAX_TOKENS?.max ?? 400;
  return chunkStructure(sections, { min, max });
}
