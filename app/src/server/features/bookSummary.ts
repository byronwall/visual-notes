import { prisma } from "~/server/db";
import { getActivePrompt, callLLM } from "~/server/lib/ai";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";
import Mustache from "mustache";

type Input = {
  book: string;
  userId?: string;
};
type Result = { html: string; model: string; runId: string };

export async function generateBookSummary(input: Input): Promise<Result> {
  // Ensure default prompt/version exists on first use
  try {
    const { ensureDefaultBookSummaryPrompt } = await import("~/server/lib/ai");
    await ensureDefaultBookSummaryPrompt();
  } catch {
    // ignore
  }

  const { version, model, temperature, topP } = await getActivePrompt(
    "book_summary"
  );

  const compiled = Mustache.render(version.template, { book: input.book });

  const run = await prisma.promptRun.create({
    data: {
      promptVersionId: version.id,
      model,
      inputVars: { book: input.book },
      compiledPrompt: compiled,
      systemUsed: version.system ?? null,
      status: "PARTIAL",
      userId: input.userId ?? null,
    },
  });

  const { output, raw } = await callLLM({
    system: version.system ?? undefined,
    user: compiled,
    model,
    temperature,
    top_p: topP,
  });

  if (!output) {
    await prisma.promptRun.update({
      where: { id: run.id },
      data: { status: "ERROR", error: "empty output" },
    });
    throw new Error("Empty AI response");
  }

  const normalizedHtml = normalizeAiOutputToHtml(output);

  await prisma.promptRun.update({
    where: { id: run.id },
    data: {
      outputHtml: normalizedHtml,
      rawResponse: raw,
      usage: raw?.usage,
      status: "SUCCESS",
    },
  });

  return { html: normalizedHtml, model, runId: run.id };
}
