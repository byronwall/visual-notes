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
import { parseCookie, MAGIC_COOKIE_NAME } from "~/server/magic-auth";
import { createHash } from "crypto";

const runInput = z
  .object({
    // Identify which prompt version to run
    promptId: z.string().optional(),
    promptVersionId: z.string().optional(),
    // Optional note link for traceability
    noteId: z.string().optional(),
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
    const cookies = parseCookie(event.request.headers.get("cookie"));
    const token = cookies[MAGIC_COOKIE_NAME] || "anonymous";
    const userHash = createHash("sha256").update(String(token)).digest("hex");
    const userId = `magic_${userHash.slice(0, 24)}`;

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
        include: {
          activeVersion: true,
        },
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

    // If linked to a note, immediately create a chat thread in LOADING state and return.
    let threadId: string | undefined = undefined;
    if (input.noteId) {
      // Title preference: Prompt task if available, else first 40 chars of selection or compiled prompt
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
          title = `Prompt run`;
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
          : compiledUser
      );
      await prisma.chatMessage.create({
        data: {
          threadId: created.id,
          role: "user",
          contentHtml: compiledHtml,
        },
      });

      // Kick off background LLM run without blocking response
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
                    : output
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
            data: { status: "DONE", hasUnread: true, lastMessageAt: new Date() },
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
          console.log(
            `[api/ai/runPrompt/bg] version=${version!.id} model=${model} ok=${!!output}`
          );
        } catch (e) {
          console.log("[api/ai/runPrompt/bg] error", e);
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
              data: { status: "DONE", hasUnread: true, lastMessageAt: new Date() },
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
                rawResponse: null,
                status: "ERROR",
                error: (e as Error)?.message || "background error",
              },
              select: { id: true },
            });
          } catch {}
        }
      })();

      // Respond immediately so UI can open the chat in pending state
      return json({
        threadId,
      });
    }

    // Fallback (no noteId): run synchronously and return full data
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
              : output
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
    return json({
      runId: run.id,
      outputHtml,
      outputText: output,
      compiledPrompt: compiledUser,
      systemPrompt: systemUsed || null,
      threadId: null,
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
