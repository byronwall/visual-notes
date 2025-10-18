import { prisma } from "~/server/db";
import { compilePrompt, getActivePrompt, callLLM } from "~/server/lib/ai";
import { normalizeAiOutputToHtml } from "~/server/lib/markdown";

type Input = {
  book: string;
  chapter: number;
  passageHtml: string;
  passageId?: string;
  userId?: string;
};
type Result = { html: string; model: string; runId: string };

export async function generateChapterSummary(input: Input): Promise<Result> {
  // Ensure a default prompt/version exists on first use
  try {
    // lazy import to avoid cycles
    const { ensureDefaultChapterSummaryPrompt } = await import(
      "~/server/lib/ai"
    );
    await ensureDefaultChapterSummaryPrompt();
  } catch {
    // ignore
  }

  const { prompt, version, model, temperature, topP } = await getActivePrompt(
    "chapter_summary"
  );
  const compiled = compilePrompt(version.template, {
    book: input.book,
    chapter: input.chapter,
    passageHtml: input.passageHtml,
  });

  const run = await prisma.promptRun.create({
    data: {
      promptVersionId: version.id,
      model,
      inputVars: {
        book: input.book,
        chapter: input.chapter,
        passageHtml: "<omitted>",
      },
      compiledPrompt: compiled,
      systemUsed: version.system ?? null,
      status: "PARTIAL",
      passageId: input.passageId ?? null,
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
