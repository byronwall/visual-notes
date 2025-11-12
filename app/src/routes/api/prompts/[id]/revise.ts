import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";

const inputSchema = z.object({
  feedback: z.string().min(1, "feedback is required"),
  // Optionally override which version to revise; defaults to active
  promptVersionId: z.string().optional(),
  // Optional model/params used for the revision LLM call
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
});

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id!;
    const body = await event.request.json();
    const input = inputSchema.parse(body);

    // Load target version (active by default)
    let version =
      input.promptVersionId
        ? await prisma.promptVersion.findUnique({ where: { id: input.promptVersionId } })
        : null;
    if (!version) {
      const prompt = await prisma.prompt.findUnique({
        where: { id },
        include: { activeVersion: true },
      });
      if (!prompt?.activeVersion)
        return json({ error: "No active version" }, { status: 400 });
      version = prompt.activeVersion;
    }
    if (!version) return json({ error: "Prompt version not found" }, { status: 404 });

    const system = REVISION_SYSTEM_PROMPT;
    const user = [
      `Here is the current prompt template (Mustache):`,
      "```prompt-template",
      version.template,
      "```",
      version.system
        ? [
            "",
            "Here is the current system prompt (if any):",
            "```system",
            version.system,
            "```",
          ].join("\n")
        : "",
      "",
      "User feedback for improving this prompt:",
      "```feedback",
      input.feedback,
      "```",
      "",
      "Please return ONLY a compact JSON object with fields:",
      `{"template": string, "system"?: string}`,
    ]
      .filter(Boolean)
      .join("\n");

    console.log("[api/prompts/:id/revise] calling LLM for revision");
    const { output } = await callLLM({
      system,
      user,
      model: input.model || "gpt-4o-mini",
      temperature: typeof input.temperature === "number" ? input.temperature : 0.2,
      top_p: input.top_p,
    });
    if (!output?.trim()) {
      return json({ error: "Empty LLM response" }, { status: 400 });
    }

    const suggestion = safeParseJsonObject(output);
    if (!suggestion || typeof suggestion.template !== "string") {
      console.log("[api/prompts/:id/revise] non-JSON or missing template. Raw:", output.slice(0, 400));
      return json({ error: "Invalid LLM response" }, { status: 400 });
    }

    // Do not create version automatically; caller will show suggestion for acceptance
    return json({
      suggestion: {
        template: suggestion.template,
        system: typeof suggestion.system === "string" ? suggestion.system : null,
      },
    });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

const REVISION_SYSTEM_PROMPT = [
  "You are an expert AI prompt engineer.",
  "You improve existing prompts based on human feedback.",
  "Constraints:",
  "- Return ONLY compact JSON. No backticks. No commentary.",
  "- Keep Mustache placeholders unchanged (e.g., {{selection}}, {{doc_text}}).",
  "- Preserve overall task intent; clarify instructions and formatting.",
  "- Prefer explicit output structure and verification checks.",
].join("\n");

function safeParseJsonObject(s: string): Record<string, unknown> | null {
  try {
    // Try to extract JSON if fenced or with text around
    const maybe = s.trim();
    const start = maybe.indexOf("{");
    const end = maybe.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(maybe.slice(start, end + 1)) as Record<string, unknown>;
    }
    return JSON.parse(maybe) as Record<string, unknown>;
  } catch {
    return null;
  }
}


