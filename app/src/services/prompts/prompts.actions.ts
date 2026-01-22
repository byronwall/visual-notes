import { action } from "@solidjs/router";
import { z } from "zod";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";

const createPromptInput = z.object({
  task: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  defaultModel: z.string().min(1).optional(),
  defaultTemp: z.number().min(0).max(2).optional(),
  defaultTopP: z.number().min(0).max(1).optional(),
  template: z.string().min(1),
  system: z.string().optional(),
  modelOverride: z.string().optional(),
  tempOverride: z.number().min(0).max(2).optional(),
  topPOverride: z.number().min(0).max(1).optional(),
  activate: z.boolean().optional(),
});

const updatePromptInput = z.object({
  id: z.string().min(1),
  task: z.string().min(1).max(128).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultModel: z.string().min(1).optional(),
  defaultTemp: z.number().min(0).max(2).optional(),
  defaultTopP: z.number().min(0).max(1).nullable().optional(),
});

const deletePromptInput = z.object({
  id: z.string().min(1),
});

const newVersionInput = z.object({
  promptId: z.string().min(1),
  template: z.string().min(1),
  system: z.string().optional(),
  modelOverride: z.string().optional(),
  tempOverride: z.number().min(0).max(2).optional(),
  topPOverride: z.number().min(0).max(1).optional(),
  activate: z.boolean().optional(),
});

const activateInput = z.object({
  promptId: z.string().min(1),
  versionId: z.string().min(1),
});

const reviseInput = z.object({
  promptId: z.string().min(1),
  feedback: z.string().min(1, "feedback is required"),
  promptVersionId: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
});

export const createPrompt = action(
  async (payload: z.infer<typeof createPromptInput>) => {
    "use server";
    const input = createPromptInput.parse(payload);
    const prompt = await prisma.prompt.create({
      data: {
        task: input.task,
        description: input.description ?? null,
        defaultModel: input.defaultModel ?? "gpt-4o-mini",
        defaultTemp:
          typeof input.defaultTemp === "number" ? input.defaultTemp : 0.2,
        defaultTopP:
          typeof input.defaultTopP === "number" ? input.defaultTopP : null,
      },
    });
    const version = await prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        template: input.template,
        system: input.system ?? null,
        modelOverride: input.modelOverride ?? null,
        tempOverride:
          typeof input.tempOverride === "number" ? input.tempOverride : null,
        topPOverride:
          typeof input.topPOverride === "number" ? input.topPOverride : null,
      },
    });
    if (input.activate !== false) {
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { activeVersionId: version.id },
      });
    }
    const full = await prisma.prompt.findUnique({
      where: { id: prompt.id },
      include: { activeVersion: true },
    });
    console.log(`[services] createPrompt task=${prompt.task}`);
    return { item: full };
  },
  "prompt-create"
);

export const updatePrompt = action(
  async (payload: z.infer<typeof updatePromptInput>) => {
    "use server";
    const input = updatePromptInput.parse(payload);
    const updates: Record<string, unknown> = {};
    if (input.task !== undefined) updates.task = input.task;
    if (input.description !== undefined) updates.description = input.description;
    if (input.defaultModel !== undefined) updates.defaultModel = input.defaultModel;
    if (input.defaultTemp !== undefined) updates.defaultTemp = input.defaultTemp;
    if (input.defaultTopP !== undefined) updates.defaultTopP = input.defaultTopP;

    if (Object.keys(updates).length === 0) {
      throw new Error("No valid fields");
    }
    const updated = await prisma.prompt.update({
      where: { id: input.id },
      data: updates,
      select: { id: true, updatedAt: true },
    });
    console.log(`[services] updatePrompt id=${input.id}`);
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  },
  "prompt-update"
);

export const deletePrompt = action(
  async (payload: z.infer<typeof deletePromptInput>) => {
    "use server";
    const input = deletePromptInput.parse(payload);
    const existing = await prisma.prompt.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error("Not found");

    const [, , deleted] = await prisma.$transaction([
      prisma.prompt.update({
        where: { id: input.id },
        data: { activeVersionId: null },
        select: { id: true },
      }),
      prisma.promptVersion.deleteMany({ where: { promptId: input.id } }),
      prisma.prompt.delete({ where: { id: input.id }, select: { id: true } }),
    ]);

    console.log(`[services] deletePrompt id=${input.id}`);
    return { id: deleted.id };
  },
  "prompt-delete"
);

export const createPromptVersion = action(
  async (payload: z.infer<typeof newVersionInput>) => {
    "use server";
    const input = newVersionInput.parse(payload);

    const prompt = await prisma.prompt.findUnique({ where: { id: input.promptId } });
    if (!prompt) throw new Error("Not found");

    const version = await prisma.promptVersion.create({
      data: {
        promptId: input.promptId,
        template: input.template,
        system: input.system ?? null,
        modelOverride: input.modelOverride ?? null,
        tempOverride:
          typeof input.tempOverride === "number" ? input.tempOverride : null,
        topPOverride:
          typeof input.topPOverride === "number" ? input.topPOverride : null,
      },
      select: { id: true },
    });
    if (input.activate) {
      await prisma.prompt.update({
        where: { id: input.promptId },
        data: { activeVersionId: version.id },
      });
    }
    console.log(`[services] createPromptVersion promptId=${input.promptId}`);
    return { id: version.id };
  },
  "prompt-version-create"
);

export const activatePromptVersion = action(
  async (payload: z.infer<typeof activateInput>) => {
    "use server";
    const input = activateInput.parse(payload);
    const prompt = await prisma.prompt.findUnique({ where: { id: input.promptId } });
    if (!prompt) throw new Error("Not found");
    await prisma.prompt.update({
      where: { id: input.promptId },
      data: { activeVersionId: input.versionId },
    });
    console.log(
      `[services] activatePromptVersion promptId=${input.promptId} version=${input.versionId}`
    );
    return { ok: true };
  },
  "prompt-version-activate"
);

export const revisePrompt = action(
  async (payload: z.infer<typeof reviseInput>) => {
    "use server";
    const input = reviseInput.parse(payload);

    let version =
      input.promptVersionId
        ? await prisma.promptVersion.findUnique({
            where: { id: input.promptVersionId },
          })
        : null;
    if (!version) {
      const prompt = await prisma.prompt.findUnique({
        where: { id: input.promptId },
        include: { activeVersion: true },
      });
      if (!prompt?.activeVersion) throw new Error("No active version");
      version = prompt.activeVersion;
    }
    if (!version) throw new Error("Prompt version not found");

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

    console.log("[services] revisePrompt calling LLM");
    const { output } = await callLLM({
      system,
      user,
      model: input.model || "gpt-4o-mini",
      temperature: typeof input.temperature === "number" ? input.temperature : 0.2,
      top_p: input.top_p,
    });
    if (!output?.trim()) throw new Error("Empty LLM response");

    const suggestion = safeParseJsonObject(output);
    if (!suggestion || typeof suggestion.template !== "string") {
      console.log(
        "[services] revisePrompt non-JSON or missing template. Raw:",
        output.slice(0, 400)
      );
      throw new Error("Invalid LLM response");
    }

    return {
      suggestion: {
        template: suggestion.template,
        system: typeof suggestion.system === "string" ? suggestion.system : null,
      },
    };
  },
  "prompt-revise"
);

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
