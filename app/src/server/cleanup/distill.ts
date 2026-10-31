import { serverEnv } from "~/env/server";
import { callLLM } from "~/server/lib/ai";
import { cleanBody } from "./note-state";

/**
 * Pulls the durable facts out of a copied or generated note. The decision
 * model only judges; writing the distilled version is an LLM's job. Without
 * an OpenAI key a local extract keeps the flow usable (and says so).
 */

export type DistillDraft = {
  title: string;
  markdown: string;
  /** Model that wrote the draft, or `local-extract`. */
  model: string;
};

export const DISTILL_MODEL = "gpt-5-mini";
export const LOCAL_EXTRACT_MODEL = "local-extract";
const MAX_BULLETS = 7;
const BODY_CAP = 24_000;

const SYSTEM = `You distill notes for the owner of a personal knowledge base.
The note was mostly copied from a website or written by a chatbot. Keep only what is worth keeping long term: concrete facts, decisions, commands, settings, numbers, names, and gotchas. Drop greetings, restated questions, hedging, and generic advice anyone could re-ask.
Reply with JSON only: {"title": string, "bullets": string[], "code": string | null}.
- title: a short plain title for the distilled content (no "Distilled" prefix).
- bullets: 3 to 7 short, self-contained statements in plain English.
- code: one short code or command snippet worth keeping, or null.`;

const FILLER =
  /^(great question|sure|certainly|of course|absolutely|here (are|is)|you can|overall|in summary|i hope)/i;

/** Sentences from the answer side of a chat, minus filler; no model call. */
export function localExtract(title: string, markdown: string): DistillDraft {
  const body = cleanBody(markdown)
    .replace(/Link back:.*$/gim, "")
    .replace(/```[\s\S]*?```/g, " ");
  const answers = body
    .split(/\n{2,}/)
    .filter((p) => !/^\*\*You:\*\*/.test(p.trim()))
    .map((p) => p.replace(/^\*\*[^*]+:\*\*\s*/, "").replace(/[*_`#>]/g, ""))
    .join(" ");
  const bullets: string[] = [];
  for (const sentence of answers.split(/(?<=[.!?])\s+/)) {
    const s = sentence.replace(/^\d+\.\s*/, "").trim();
    if (s.length < 25 || s.length > 220 || FILLER.test(s)) continue;
    bullets.push(s);
    if (bullets.length >= MAX_BULLETS) break;
  }
  const code = markdown.match(/```[a-z]*\n([\s\S]*?)```/)?.[1]?.trim() ?? null;
  return {
    title,
    markdown: toMarkdown(bullets, code),
    model: LOCAL_EXTRACT_MODEL,
  };
}

function toMarkdown(bullets: string[], code: string | null): string {
  const list = bullets.map((b) => `- ${b}`).join("\n");
  return code ? `${list}\n\n\`\`\`\n${code}\n\`\`\`` : list;
}

export function parseDraftJson(output: string): {
  title?: string;
  bullets: string[];
  code: string | null;
} | null {
  const json = output.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b: unknown) => typeof b === "string" && b.trim())
      : [];
    if (!bullets.length) return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() : undefined,
      bullets: bullets.slice(0, MAX_BULLETS),
      code:
        typeof parsed.code === "string" && parsed.code.trim()
          ? parsed.code.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export const POST_EVENT_FOCUS = `This note is about an event or plan whose date has passed. Keep only what would help the owner next time: packing lists, contacts, places, costs, lessons, what to bring or do differently. Drop schedules, RSVPs, carpools, forecasts, and anything tied to that one date. Write bullets as reusable advice, not as a log of the event.`;

const EVERGREEN_HEADING =
  /^#{1,4}\s+.*\b(packing|checklist|contacts?|lessons?|next time|bring|tips|notes for)\b/i;

/** Sections whose heading says they are reusable; no model call. */
export function localEvergreen(title: string, markdown: string): DistillDraft {
  const sections = cleanBody(markdown).split(/\n(?=#{1,4}\s)/);
  const keep = sections.filter((s) => EVERGREEN_HEADING.test(s.trim()));
  const bullets = keep.flatMap((s) =>
    s
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
      .filter((l) => l.length > 2),
  );
  return {
    title: `${title}: for next time`,
    markdown: toMarkdown(bullets.slice(0, 12), null),
    model: LOCAL_EXTRACT_MODEL,
  };
}

export async function draftDistill(input: {
  docId: string;
  title: string;
  markdown: string;
  /** Extra instruction for other cleanup actions (post-event summaries). */
  focus?: string;
  /** What started the call (see `LlmRequest.trigger`). */
  trigger: string;
}): Promise<DistillDraft> {
  const local = () =>
    input.focus === POST_EVENT_FOCUS
      ? localEvergreen(input.title, input.markdown)
      : localExtract(input.title, input.markdown);
  if (!serverEnv.OPENAI_API_KEY?.trim()) return local();
  const body = cleanBody(input.markdown).slice(0, BODY_CAP);
  const { output } = await callLLM({
    model: DISTILL_MODEL,
    system: input.focus ? `${SYSTEM}\n${input.focus}` : SYSTEM,
    user: JSON.stringify({ title: input.title, body }),
    noteId: input.docId,
    trigger: input.trigger,
  });
  const parsed = output ? parseDraftJson(output) : null;
  if (!parsed) {
    console.warn("[cleanup-distill] unparseable draft; using local extract");
    return local();
  }
  return {
    title: parsed.title || input.title,
    markdown: toMarkdown(parsed.bullets, parsed.code),
    model: DISTILL_MODEL,
  };
}
