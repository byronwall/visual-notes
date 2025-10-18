import { prisma } from "~/server/db";
import { callLLM } from "~/server/lib/ai";

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generatePromptTemplateFromFeedback({
  task,
  minRating,
  lookbackDays,
  limit,
  modelOverride,
  createdById,
}: {
  task: string;
  minRating?: number;
  lookbackDays?: number;
  limit?: number;
  modelOverride?: string;
  createdById?: string;
}) {
  const prompt = await prisma.prompt.findUnique({ where: { task } });
  if (!prompt) throw new Error("Prompt not found for task");

  const createdAfter = lookbackDays
    ? new Date(Date.now() - Math.max(1, lookbackDays) * 24 * 60 * 60 * 1000)
    : undefined;

  const runs = await prisma.promptRun.findMany({
    where: {
      promptVersion: { Prompt: { task } },
      ...(createdAfter ? { createdAt: { gte: createdAfter } } : {}),
      HumanFeedback: {
        some: minRating ? { rating: { gte: minRating } } : {},
      },
    },
    include: { HumanFeedback: true, promptVersion: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(10, limit ?? 100)),
  });

  // Collect feedback items with rating/comment
  const feedbackItems: Array<{
    rating: number | null;
    comment: string | null;
    compiledPrompt: string;
    outputHtml: string | null;
    createdAt: Date;
  }> = [];

  for (const r of runs as any[]) {
    for (const fb of r.HumanFeedback || []) {
      feedbackItems.push({
        rating: typeof fb.rating === "number" ? fb.rating : null,
        comment: fb.comment ?? null,
        compiledPrompt: r.compiledPrompt || "",
        outputHtml: r.outputHtml || null,
        createdAt: new Date(fb.createdAt || r.createdAt),
      });
    }
  }

  const withRatings = feedbackItems.filter((f) => typeof f.rating === "number");
  if (!withRatings.length) {
    throw new Error("No rated human feedback found for this task");
  }

  // Sort by rating to get positive/negative examples
  withRatings.sort(
    (a, b) =>
      b.rating! - a.rating! || b.createdAt.getTime() - a.createdAt.getTime()
  );
  const positive = withRatings.slice(0, Math.min(10, withRatings.length));
  const negative = withRatings
    .slice()
    .sort(
      (a, b) =>
        a.rating! - b.rating! || b.createdAt.getTime() - a.createdAt.getTime()
    )
    .slice(0, Math.min(10, withRatings.length));

  const mkBlock = (label: string, items: typeof positive) =>
    [
      label,
      ...items.map((s) =>
        [
          `RATING: ${s.rating}`,
          `COMMENT: ${s.comment ?? ""}`,
          `COMPILED_PROMPT:\n${(s.compiledPrompt || "").slice(0, 2000)}`,
        ].join("\n")
      ),
    ].join("\n\n");

  const sampleBlocks = [
    mkBlock("=== POSITIVE FEEDBACK EXAMPLES ===", positive),
    mkBlock("=== NEGATIVE FEEDBACK EXAMPLES ===", negative),
  ].join("\n\n");

  const system = [
    "You are a senior prompt engineer.",
    "Your ONLY job is to output a JSON object describing a prompt template.",
    "Do NOT generate Bible content or HTML output. Do NOT copy phrases from examples.",
  ].join(" \n");

  const instruction = [
    `You are improving the Mustache user template for task "${task}" using human feedback ratings (1..5) and comments.`,
    "Design an instructional template (for the model) — not sample output.",
    "The template must strictly use these variables: {{book}} {{chapter}} {{{passageHtml}}} (triple braces for raw HTML).",
    "Hard constraints:",
    "- Do not include any chapter-specific content, quotes, summaries, table rows, bullet items, or prayers from examples.",
    "- Write concise, explicit instructions and formatting rules only (what to produce, how to structure).",
    "- Include guardrails to avoid hallucination and to keep content concise.",
    "- Keep under 2,000 characters.",
    "- Safe for direct rendering as a user prompt.",
    'Return JSON only with shape { "template": string, "system": string|null, "notes": string }.',
  ].join("\n\n");

  const { output } = await callLLM({
    system,
    model: modelOverride || "gpt-4o-mini",
    temperature: 0,
    user: [instruction, sampleBlocks].join("\n\n"),
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(output || "");
  } catch {
    const m = (output || "").match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {}
    }
  }
  if (!parsed?.template || typeof parsed.template !== "string") {
    throw new Error("Model did not return a template");
  }

  // Basic safety validation: ensure required variables are present
  const tmpl = String(parsed.template);
  const hasVars =
    tmpl.includes("{{book}}") &&
    tmpl.includes("{{chapter}}") &&
    (tmpl.includes("{{{passageHtml}}}") || tmpl.includes("{{& passageHtml}}"));
  if (!hasVars) {
    throw new Error(
      "Synthesized template missing required variables {{book}} {{chapter}} {{{passageHtml}}}"
    );
  }

  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      template: String(parsed.template).slice(0, 8000),
      system: parsed.system ? String(parsed.system).slice(0, 4000) : null,
      metadata: {
        synthesisNotes: parsed.notes ?? null,
        source: "human_feedback",
      },
      createdById: createdById ?? null,
    },
  });

  return { version };
}
