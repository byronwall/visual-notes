import { query } from "@solidjs/router";
import { prisma } from "~/server/db";

export type RunStatus = "SUCCESS" | "ERROR" | "PARTIAL";

export type PromptRunItem = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  promptVersionId: string;
  compiledPrompt: string;
  systemUsed?: string | null;
  outputHtml?: string | null;
  rawResponse?: unknown | null;
  inputVars?: Record<string, unknown> | null;
  promptId?: string | null;
  promptTask?: string | null;
  versionId?: string | null;
};

export type PromptRunDetail = {
  id: string;
  status: RunStatus;
  model: string;
  createdAt: string;
  error?: string | null;
  promptVersionId: string;
  compiledPrompt: string;
  systemUsed?: string | null;
  outputHtml?: string | null;
  rawResponse?: unknown | null;
  inputVars?: Record<string, unknown> | null;
  promptVersion?: {
    id: string;
    promptId: string;
    Prompt?: { id: string; task: string; defaultModel: string } | null;
  } | null;
  HumanFeedback?: Array<{
    id: string;
    rating?: number | null;
    comment?: string | null;
    createdAt: string;
  }>;
};

export type PromptRunsQuery = {
  limit?: number;
  promptId?: string;
  versionId?: string;
};

export const fetchPromptRuns = query(
  async (input: PromptRunsQuery = {}): Promise<PromptRunItem[]> => {
    "use server";
    const limit = Math.min(200, Math.max(1, Number(input.limit ?? 50)));
    const promptId = input.promptId || undefined;
    const versionId = input.versionId || undefined;
    const where = versionId
      ? { promptVersionId: versionId }
      : promptId
      ? { promptVersion: { promptId } }
      : {};
    const runs = await prisma.promptRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        promptVersion: {
          include: {
            Prompt: {
              select: { id: true, task: true },
            },
          },
        },
      },
    });
    console.log(
      `[services] fetchPromptRuns count=${runs.length} promptId=${promptId || ""} versionId=${
        versionId || ""
      }`
    );
    return runs.map((r) => ({
      id: r.id,
      status: r.status as RunStatus,
      model: r.model,
      createdAt: r.createdAt.toISOString(),
      error: r.error,
      promptVersionId: r.promptVersionId,
      compiledPrompt: r.compiledPrompt,
      systemUsed: r.systemUsed,
      outputHtml: r.outputHtml,
      rawResponse: r.rawResponse,
      inputVars: r.inputVars as Record<string, unknown> | null,
      promptId: r.promptVersion?.Prompt?.id ?? null,
      promptTask: r.promptVersion?.Prompt?.task ?? null,
      versionId: r.promptVersion?.id ?? null,
    }));
  },
  "ai-runs"
);

export const fetchPromptRun = query(
  async (id: string): Promise<PromptRunDetail | null> => {
    "use server";
    if (!id) return null;
    const run = await prisma.promptRun.findUnique({
      where: { id },
      include: {
        promptVersion: {
          include: {
            Prompt: { select: { id: true, task: true, defaultModel: true } },
          },
        },
        HumanFeedback: true,
      },
    });
    if (!run) return null;
    console.log(`[services] fetchPromptRun id=${id}`);
    return {
      id: run.id,
      status: run.status as RunStatus,
      model: run.model,
      createdAt: run.createdAt.toISOString(),
      error: run.error,
      promptVersionId: run.promptVersionId,
      compiledPrompt: run.compiledPrompt,
      systemUsed: run.systemUsed,
      outputHtml: run.outputHtml,
      rawResponse: run.rawResponse,
      inputVars: run.inputVars as Record<string, unknown> | null,
      promptVersion: run.promptVersion
        ? {
            id: run.promptVersion.id,
            promptId: run.promptVersion.promptId,
            Prompt: run.promptVersion.Prompt
              ? {
                  id: run.promptVersion.Prompt.id,
                  task: run.promptVersion.Prompt.task,
                  defaultModel: run.promptVersion.Prompt.defaultModel,
                }
              : null,
          }
        : null,
      HumanFeedback: (run.HumanFeedback || []).map((h) => ({
        id: h.id,
        rating: h.rating,
        comment: h.comment,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  },
  "ai-run"
);
