import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { z } from "zod";
import { prisma } from "~/server/db";
import {
  sanitizeHtmlContent,
  looksLikeMarkdown,
  normalizeMarkdownToHtml,
} from "~/server/lib/markdown";
import { callLLM } from "~/server/lib/ai";

const runInput = z
  .object({
    // Identify which prompt version to run
    promptId: z.string().optional(),
    promptVersionId: z.string().optional(),
    // Optional model override
    model: z.string().optional(),
    // Arbitrary variables for Mustache placeholders
    vars: z.record(z.any()).optional(),
    // Helpful editor context
    selection_text: z.string().optional(),
    selection_html: z.string().optional(),
    doc_text: z.string().optional(),
    doc_html: z.string().optional(),
  })
  .refine((v) => Boolean(v.promptId || v.promptVersionId), {
    message: "promptId or promptVersionId is required",
    path: ["promptId"],
  });

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const input = runInput.parse(body);

    // Debug: log incoming selection info (lengths only)
    console.log("[api/ai/runPrompt] incoming", {
      promptId: input.promptId,
      model: input.model,
      selection_text_len: input.selection_text?.length || 0,
      doc_text_len: input.doc_text?.length || 0,
      vars_has_selection_text:
        typeof (input.vars as any)?.selection_text === "string" &&
        (input.vars as any)?.selection_text.length > 0,
    });

    let version:
      | (Awaited<ReturnType<typeof prisma.promptVersion.findUnique>> & {
          Prompt: {
            id: string;
            defaultModel: string;
            defaultTemp: number | null;
            defaultTopP: number | null;
          } | null;
        })
      | null = null;

    if (input.promptVersionId) {
      version = await prisma.promptVersion.findUnique({
        where: { id: input.promptVersionId },
        include: {
          Prompt: {
            select: {
              id: true,
              defaultModel: true,
              defaultTemp: true,
              defaultTopP: true,
            },
          },
        },
      });
    } else if (input.promptId) {
      const prompt = await prisma.prompt.findUnique({
        where: { id: input.promptId },
        include: { activeVersion: true },
      });
      if (!prompt?.activeVersion) {
        return json({ error: "No active version" }, { status: 400 });
      }
      version = Object.assign({}, prompt.activeVersion, {
        Prompt: {
          id: prompt.id,
          defaultModel: prompt.defaultModel,
          defaultTemp: prompt.defaultTemp ?? null,
          defaultTopP: prompt.defaultTopP ?? null,
        },
      });
    }
    if (!version || !version.Prompt) {
      return json({ error: "Prompt version not found" }, { status: 404 });
    }

    const model =
      input.model ??
      version.modelOverride ??
      version.Prompt.defaultModel ??
      "gpt-4o-mini";
    const temperature =
      (typeof version.tempOverride === "number"
        ? version.tempOverride
        : version.Prompt.defaultTemp) ?? 0.2;
    const top_p =
      (typeof version.topPOverride === "number"
        ? version.topPOverride
        : version.Prompt.defaultTopP) ?? undefined;

    // Preserve user-provided vars.selection_text when top-level selection is empty
    const baseVars = (input.vars || {}) as Record<string, unknown>;
    const selectionFromVars =
      typeof baseVars.selection_text === "string" &&
      (baseVars.selection_text as string).trim().length > 0
        ? (baseVars.selection_text as string)
        : undefined;
    const selection_text = selectionFromVars ?? input.selection_text ?? "";
    const vars = {
      ...baseVars,
      selection_text,
      selection_html: input.selection_html ?? "",
      doc_text: input.doc_text ?? "",
      // selection_html and doc_html may contain HTML; allow triple mustaches in template for raw injection
      doc_html: input.doc_html ?? "",
    } as Record<string, unknown>;

    // Alias {{selection}} to selection_text if not explicitly provided
    if (
      typeof (vars as any).selection !== "string" ||
      !((vars as any).selection as string)?.trim().length
    ) {
      (vars as any).selection = selection_text;
    }

    // If the template doesn't reference {{selection}} and we have selection, append it
    let templateToUse = version.template;
    if (
      ((vars as any).selection as string)?.trim().length &&
      !templateToUse.includes("{{selection")
    ) {
      templateToUse = `${templateToUse}\n\n{{selection}}`;
      console.log("[api/ai/runPrompt] auto-appended {{selection}} to template");
    }

    const compiledUser = await renderMustache(templateToUse, vars);
    const systemUsed = version.system ?? undefined;

    // Debug: log compiled prompt sizes
    console.log("[api/ai/runPrompt] compiled", {
      compiled_len: compiledUser.length,
      selection_text_len: (vars.selection_text as string)?.length || 0,
    });

    const { output, raw } = await callLLM({
      system: systemUsed,
      user: compiledUser,
      model,
      temperature,
      top_p,
    });

    const outputHtml = output
      ? sanitizeHtmlContent(
          looksLikeMarkdown(output) ? normalizeMarkdownToHtml(output) : output
        )
      : null;

    // Debug: check if compiled prompt contains selection_text
    try {
      const sel = (vars.selection_text as string) || "";
      const contains = sel ? compiledUser.includes(sel) : false;
      console.log("[api/ai/runPrompt] compiled contains selection_text:", {
        contains,
        sel_len: sel.length,
      });
    } catch {}

    const run = await prisma.promptRun.create({
      data: {
        promptVersionId: version.id,
        model,
        inputVars: vars as any,
        compiledPrompt: compiledUser,
        systemUsed: systemUsed ?? null,
        outputHtml,
        rawResponse: raw as any,
        status: output ? "SUCCESS" : "ERROR",
        error: output ? null : "empty output",
      },
      select: { id: true },
    });

    console.log(
      `[api/ai/runPrompt] version=${version.id} model=${model} ok=${!!output}`
    );
    return json({
      runId: run.id,
      outputHtml,
      outputText: output,
      compiledPrompt: compiledUser,
      systemPrompt: systemUsed || null,
    });
  } catch (e) {
    const msg = (e as Error)?.message || "Invalid request";
    return json({ error: msg }, { status: 400 });
  }
}

async function renderMustache(
  template: string,
  vars: Record<string, unknown>
): Promise<string> {
  // Lazy import to avoid bundling mustache on client; runtime is server-only here

  const { default: Mustache } = await import("mustache");
  const rendered = await Mustache.render(template, vars);
  if (!rendered.trim()) return "";
  return rendered;
}
