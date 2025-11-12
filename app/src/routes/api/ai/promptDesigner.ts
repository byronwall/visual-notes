import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { callLLM } from "~/server/lib/ai";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const inputSchema = z.object({
  transcript: z.array(turnSchema).min(0),
  mode: z.enum(["qa", "generate"]).optional(), // default qa
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
});

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = inputSchema.parse(body);

    const mode = input.mode || "qa";
    console.log(
      "[api/ai/promptDesigner] mode=",
      mode,
      "transcript len=",
      input.transcript.length
    );

    if (mode === "qa") {
      const system = QA_DESIGNER_SYSTEM_PROMPT;
      const user = buildQaUserMessage(input.transcript);
      const { output } = await callLLM({
        system,
        user,
        model: input.model || "gpt-4o-mini",
        temperature:
          typeof input.temperature === "number" ? input.temperature : 0.2,
        top_p: input.top_p,
      });
      if (!output?.trim())
        return json({ error: "Empty LLM response" }, { status: 400 });
      const obj = safeParseJsonObject(output);
      // Expected: { question: string, summary: string }
      const question =
        typeof (obj as any)?.question === "string"
          ? (obj as any).question
          : undefined;
      const summary =
        typeof (obj as any)?.summary === "string"
          ? (obj as any).summary
          : undefined;
      if (!question || !summary)
        return json({ error: "Invalid LLM response" }, { status: 400 });
      return json({ question, summary });
    }

    // mode === "generate"
    {
      const system = GENERATOR_SYSTEM_PROMPT;
      const user = buildGeneratorUserMessage(input.transcript);
      const { output } = await callLLM({
        system,
        user,
        model: input.model || "gpt-4o-mini",
        temperature:
          typeof input.temperature === "number" ? input.temperature : 0.2,
        top_p: input.top_p,
      });
      if (!output?.trim())
        return json({ error: "Empty LLM response" }, { status: 400 });
      const obj = safeParseJsonObject(output);
      if (obj && typeof (obj as any).proposal?.template === "string") {
        const p = (obj as any).proposal;
        return json({
          proposal: {
            task: typeof p.task === "string" ? p.task : undefined,
            description:
              typeof p.description === "string" ? p.description : undefined,
            defaultModel:
              typeof p.defaultModel === "string" ? p.defaultModel : undefined,
            defaultTemp:
              typeof p.defaultTemp === "number"
                ? (p.defaultTemp as number)
                : undefined,
            template: p.template as string,
            system: typeof p.system === "string" ? p.system : undefined,
          },
        });
      }
      return json({ error: "Invalid proposal response" }, { status: 400 });
    }
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

function buildQaUserMessage(
  transcript: Array<{ role: "user" | "assistant"; content: string }>
): string {
  const lines: string[] = [];
  lines.push("Transcript so far (Q&A to clarify the prompt goal):");
  for (const t of transcript) lines.push(`[${t.role}] ${t.content}`);
  lines.push("");
  lines.push(
    'Return JSON only: {"question": "next concise question", "summary": "concise understanding of user\'s goal so far"}'
  );
  return lines.join("\n");
}

function buildGeneratorUserMessage(
  transcript: Array<{ role: "user" | "assistant"; content: string }>
): string {
  const lines: string[] = [];
  lines.push("Transcript so far (summarize into a complete prompt proposal):");
  for (const t of transcript) lines.push(`[${t.role}] ${t.content}`);
  lines.push("");
  lines.push(
    'Return JSON only: {"proposal": {"task": string, "description"?: string, "defaultModel"?: string, "defaultTemp"?: number, "template": string, "system"?: string}}'
  );
  return lines.join("\n");
}

const QA_DESIGNER_SYSTEM_PROMPT = [
  "You are an expert AI prompt designer running a clarifying Q&A.",
  "Each turn, produce:",
  "1) question: one concise, practical question to move towards a well-formed prompt.",
  "2) summary: a brief statement of your current understanding of the user's goal.",
  "Focus areas to clarify: goal, inputs (e.g., {{selection}}, {{doc_text}}, {{doc_html}}), output structure, constraints, tone.",
  "Return ONLY compact JSON. No backticks. No extra commentary.",
].join("\n");

const GENERATOR_SYSTEM_PROMPT = [
  "You are an expert AI prompt designer.",
  "Given the Q&A transcript, produce a complete prompt proposal.",
  "Use Mustache placeholders verbatim where appropriate (e.g., {{selection}}, {{doc_text}}, {{doc_html}}).",
  "Prefer explicit headings and structured outputs.",
  "Return ONLY compact JSON. No backticks. No extra commentary.",
].join("\n");

function safeParseJsonObject(s: string): Record<string, unknown> | null {
  try {
    const trimmed = s.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    }
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}
