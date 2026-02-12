import { action } from "@solidjs/router";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";
import {
  looksLikeMarkdown,
  normalizeMarkdownToHtml,
  sanitizeHtmlContent,
} from "~/server/lib/markdown";
import { getMagicUserIdFromEvent } from "~/services/ai/ai-auth";
import { logActionEvent } from "~/server/events/action-events";

const runInput = z
  .object({
    promptId: z.string().optional(),
    promptVersionId: z.string().optional(),
    noteId: z.string().optional(),
    model: z.string().optional(),
    vars: z.record(z.any()).optional(),
    selection_text: z.string().optional(),
    selection_html: z.string().optional(),
    doc_text: z.string().optional(),
    doc_html: z.string().optional(),
  })
  .refine((v) => Boolean(v.promptId || v.promptVersionId), {
    message: "promptId or promptVersionId is required",
    path: ["promptId"],
  });

export type RunPromptResponse =
  | { threadId: string }
  | {
      runId: string;
      outputHtml: string | null;
      outputText: string | null;
      compiledPrompt: string;
      systemPrompt: string | null;
      threadId: null;
    };

export const runPrompt = action(
  async (payload: z.infer<typeof runInput>): Promise<RunPromptResponse> => {
    "use server";
    const input = runInput.parse(payload);
    const userId = getMagicUserIdFromEvent();
    await logActionEvent({
      eventType: "ai.prompt.run_started",
      entityType: "prompt_run",
      entityId: input.promptVersionId ?? input.promptId ?? null,
      relatedDocId: input.noteId ?? null,
      payload: {
        promptId: input.promptId ?? null,
        promptVersionId: input.promptVersionId ?? null,
        hasSelection: Boolean(input.selection_text?.trim()),
      },
      context: { actorId: userId, actorType: "magic_user" },
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
        include: {
          activeVersion: true,
        },
      });
      if (!prompt?.activeVersion) {
        throw new Error("No active version");
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
      throw new Error("Prompt version not found");
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
      doc_html: input.doc_html ?? "",
    } as Record<string, unknown>;

    if (
      typeof (vars as any).selection !== "string" ||
      !((vars as any).selection as string)?.trim().length
    ) {
      (vars as any).selection = selection_text;
    }

    let templateToUse = version.template;
    if (
      ((vars as any).selection as string)?.trim().length &&
      !templateToUse.includes("{{selection")
    ) {
      templateToUse = `${templateToUse}\n\n{{selection}}`;
      console.log(
        "[ai.runPrompt] normalized template with selection placeholder",
      );
    }

    const compiledUser = await renderMustache(templateToUse, vars);
    const systemUsed = version.system ?? undefined;

    let threadId: string | undefined = undefined;
    if (input.noteId) {
      let title = "Prompt run";
      try {
        const parentPrompt = await prisma.prompt.findFirst({
          where: { versions: { some: { id: version.id } } },
          select: { task: true },
        });
        if (parentPrompt?.task) title = `Prompt: ${parentPrompt.task}`;
      } catch {}
      if (title === "Prompt run") {
        const sel = String(vars.selection_text || "").trim();
        if (sel) {
          title = `Selection: ${sel.slice(0, 40)}${sel.length > 40 ? "…" : ""}`;
        } else {
          title = "Prompt run";
        }
      }
      const created = await prisma.chatThread.create({
        data: {
          userId,
          noteId: input.noteId,
          title,
          status: "LOADING",
          hasUnread: false,
          lastMessageAt: new Date(),
        },
        select: { id: true },
      });
      threadId = created.id;
      const compiledHtml = sanitizeHtmlContent(
        looksLikeMarkdown(compiledUser)
          ? normalizeMarkdownToHtml(compiledUser)
          : compiledUser,
      );
      await prisma.chatMessage.create({
        data: {
          threadId: created.id,
          role: "user",
          contentHtml: compiledHtml,
        },
      });

      void (async () => {
        try {
          const { output, raw } = await callLLM({
            system: systemUsed,
            user: compiledUser,
            model,
            temperature,
            top_p,
            noteId: input.noteId,
          });
          const outputHtml =
            output && output.trim().length
              ? sanitizeHtmlContent(
                  looksLikeMarkdown(output)
                    ? normalizeMarkdownToHtml(output)
                    : output,
                )
              : "<p>(no response)</p>";
          await prisma.chatMessage.create({
            data: {
              threadId: created.id,
              role: "assistant",
              contentHtml: outputHtml,
            },
          });
          await prisma.chatThread.update({
            where: { id: created.id },
            data: {
              status: "DONE",
              hasUnread: true,
              lastMessageAt: new Date(),
            },
          });
          await prisma.promptRun.create({
            data: {
              promptVersionId: version!.id,
              model,
              inputVars: vars as any,
              compiledPrompt: compiledUser,
              systemUsed: systemUsed ?? null,
              noteId: input.noteId ?? null,
              outputHtml,
              rawResponse: raw as any,
              status: output ? "SUCCESS" : "ERROR",
              error: output ? null : "empty output",
            },
            select: { id: true },
          });
          await logActionEvent({
            eventType: "ai.prompt.run_finished",
            entityType: "prompt_run",
            entityId: created.id,
            relatedDocId: input.noteId ?? null,
            payload: {
              status: output ? "SUCCESS" : "ERROR",
              model,
              outputLength: output?.length ?? 0,
            },
            context: { actorId: userId, actorType: "magic_user" },
          });
          console.log(
            `[ai.runPrompt/bg] version=${version!.id} model=${model} ok=${!!output}`,
          );
        } catch (e) {
          console.log("[ai.runPrompt/bg] error", e);
          try {
            await prisma.chatMessage.create({
              data: {
                threadId: created.id,
                role: "assistant",
                contentHtml:
                  "<p>There was an error generating a response. Please try again.</p>",
              },
            });
            await prisma.chatThread.update({
              where: { id: created.id },
              data: {
                status: "DONE",
                hasUnread: true,
                lastMessageAt: new Date(),
              },
            });
            await prisma.promptRun.create({
              data: {
                promptVersionId: version!.id,
                model,
                inputVars: vars as any,
                compiledPrompt: compiledUser,
                systemUsed: systemUsed ?? null,
                noteId: input.noteId ?? null,
                outputHtml: null,
                rawResponse: Prisma.JsonNull,
                status: "ERROR",
                error: (e as Error)?.message || "background error",
              },
              select: { id: true },
            });
            await logActionEvent({
              eventType: "ai.prompt.run_finished",
              entityType: "prompt_run",
              entityId: created.id,
              relatedDocId: input.noteId ?? null,
              payload: {
                status: "ERROR",
                model,
                error: (e as Error)?.message || "background error",
              },
              context: { actorId: userId, actorType: "magic_user" },
            });
          } catch {}
        }
      })();

      return { threadId };
    }

    const { output, raw } = await callLLM({
      system: systemUsed,
      user: compiledUser,
      model,
      temperature,
      top_p,
      noteId: input.noteId,
    });
    const outputHtml =
      output && output.trim().length
        ? sanitizeHtmlContent(
            looksLikeMarkdown(output)
              ? normalizeMarkdownToHtml(output)
              : output,
          )
        : null;
    const run = await prisma.promptRun.create({
      data: {
        promptVersionId: version.id,
        model,
        inputVars: vars as any,
        compiledPrompt: compiledUser,
        systemUsed: systemUsed ?? null,
        noteId: input.noteId ?? null,
        outputHtml,
        rawResponse: raw as any,
        status: output ? "SUCCESS" : "ERROR",
        error: output ? null : "empty output",
      },
      select: { id: true },
    });
    await logActionEvent({
      eventType: "ai.prompt.run_finished",
      entityType: "prompt_run",
      entityId: run.id,
      relatedDocId: input.noteId ?? null,
      payload: {
        status: output ? "SUCCESS" : "ERROR",
        model,
        outputLength: output?.length ?? 0,
      },
      context: { actorId: userId, actorType: "magic_user" },
    });
    return {
      runId: run.id,
      outputHtml,
      outputText: output ?? null,
      compiledPrompt: compiledUser,
      systemPrompt: systemUsed || null,
      threadId: null,
    };
  },
  "ai-run-prompt",
);

async function renderMustache(
  template: string,
  vars: Record<string, unknown>,
): Promise<string> {
  const { default: Mustache } = await import("mustache");
  const rendered = await Mustache.render(template, vars);
  if (!rendered.trim()) return "";
  return rendered;
}
