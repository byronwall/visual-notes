import Mustache from "mustache";
import { prisma } from "~/server/db";

type Vars = { book: string; chapter: number; passageHtml: string };

export async function ensureDefaultChapterSummaryPrompt() {
  const task = "chapter_summary";
  const existing = await prisma.prompt.findUnique({ where: { task } });
  if (existing?.activeVersionId) return existing;

  if (existing && !existing.activeVersionId) {
    // Create an initial version if missing
    const version = await prisma.promptVersion.create({
      data: {
        promptId: existing.id,
        template: defaultChapterSummaryTemplate,
        system: "You are a Bible study guide that responds in HTML.",
      },
    });
    await prisma.prompt.update({
      where: { id: existing.id },
      data: { activeVersionId: version.id },
    });
    return prisma.prompt.findUnique({
      where: { id: existing.id },
      include: { activeVersion: true },
    });
  }

  const prompt = await prisma.prompt.create({
    data: {
      task,
      description:
        "HTML chapter summary with table, scenes, character map, themes, reflection, prayer",
      defaultModel: "gpt-4o-mini",
      defaultTemp: 0.2,
    },
  });
  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      template: defaultChapterSummaryTemplate,
      system: "You are a Bible study guide that responds in HTML.",
    },
  });
  await prisma.prompt.update({
    where: { id: prompt.id },
    data: { activeVersionId: version.id },
  });
  return prisma.prompt.findUnique({
    where: { id: prompt.id },
    include: { activeVersion: true },
  });
}

export async function ensureDefaultBookSummaryPrompt() {
  const task = "book_summary";
  const existing = await prisma.prompt.findUnique({ where: { task } });
  if (existing?.activeVersionId) return existing;

  if (existing && !existing.activeVersionId) {
    const version = await prisma.promptVersion.create({
      data: {
        promptId: existing.id,
        template: defaultBookSummaryTemplate,
        system: "You are a Bible study guide that responds in HTML.",
      },
    });
    await prisma.prompt.update({
      where: { id: existing.id },
      data: { activeVersionId: version.id },
    });
    return prisma.prompt.findUnique({
      where: { id: existing.id },
      include: { activeVersion: true },
    });
  }

  const prompt = await prisma.prompt.create({
    data: {
      task,
      description:
        "HTML book overview: multi-paragraph summary, key characters, historical timing, significance",
      defaultModel: "gpt-4o-mini",
      defaultTemp: 0.2,
    },
  });
  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      template: defaultBookSummaryTemplate,
      system: "You are a Bible study guide that responds in HTML.",
    },
  });
  await prisma.prompt.update({
    where: { id: prompt.id },
    data: { activeVersionId: version.id },
  });
  return prisma.prompt.findUnique({
    where: { id: prompt.id },
    include: { activeVersion: true },
  });
}

export async function getActivePrompt(task: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { task },
    include: { activeVersion: true },
  });
  if (!prompt?.activeVersion)
    throw new Error(`No active version for task=${task}`);
  const v = prompt.activeVersion;
  const model = v.modelOverride ?? prompt.defaultModel;
  const temperature = v.tempOverride ?? prompt.defaultTemp;
  const topP = v.topPOverride ?? prompt.defaultTopP ?? undefined;
  return { prompt, version: v, model, temperature, topP };
}

export function compilePrompt(template: string, vars: Vars) {
  const rendered = Mustache.render(template, {
    ...vars,
    // Ensure passageHtml is injected raw
    passageHtml: () => vars.passageHtml,
  });
  if (!rendered.trim()) throw new Error("Compiled prompt is empty");
  return rendered;
}

export async function callLLM(opts: {
  system?: string;
  user: string;
  model: string;
  temperature?: number;
  top_p?: number;
  noteId?: string;
}) {
  // Create a centralized LLM request log record first (status PARTIAL)
  const req = await prisma.llmRequest.create({
    data: {
      model: opts.model,
      system: opts.system ?? null,
      userPrompt: opts.user,
      temperature:
        typeof opts.temperature === "number" ? opts.temperature : null,
      topP: typeof opts.top_p === "number" ? opts.top_p : null,
      status: "PARTIAL",
      noteId: opts.noteId ?? null,
    },
  });

  const url = "https://api.openai.com/v1/responses";
  let txt: string = "";
  let json: any = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: opts.model,
        // Provide plain string input for maximal compatibility with Responses API
        input: opts.system ? `${opts.system}\n\n${opts.user}` : opts.user,
        temperature: opts.temperature ?? 0.2,
        top_p: opts.top_p,
      }),
    });

    txt = await res.text();
    if (!res.ok) {
      await prisma.llmRequest.update({
        where: { id: req.id },
        data: {
          status: "ERROR",
          error: `OpenAI ${res.status}: ${txt.slice(0, 400)}`,
          rawResponse: safeParseJson(txt),
        },
      });
      console.error("[llm] error:", txt.slice(0, 500));
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 400)}`);
    }
    json = JSON.parse(txt);
  } catch (err: any) {
    // Network/parse error
    await prisma.llmRequest.update({
      where: { id: req.id },
      data: {
        status: "ERROR",
        error: String(err?.message || err || "unknown error"),
      },
    });
    throw err;
  }
  // Try multiple schema shapes from the Responses API and legacy chat API
  let output: string | undefined = json?.output_text?.trim?.();

  if (!output && Array.isArray(json?.output)) {
    // Aggregate all text parts from output messages
    try {
      const parts: string[] = [];
      for (const item of json.output) {
        const content = item?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            const text = c?.text ?? c?.["output_text"]; // handle different part keys
            if (typeof text === "string" && text.trim())
              parts.push(text.trim());
          }
        }
      }
      if (parts.length) output = parts.join("\n").trim();
    } catch {
      // ignore
    }
  }

  if (!output) {
    // Fallback for chat.completions schema
    const maybe = json?.choices?.[0]?.message?.content;
    if (typeof maybe === "string") output = maybe.trim();
    if (!output && Array.isArray(maybe)) {
      const textParts = maybe
        .map((p: any) => p?.text)
        .filter((t: any) => typeof t === "string" && t.trim());
      if (textParts.length) output = textParts.join("\n").trim();
    }
  }

  // Extract usage/token info if present
  const usage = json?.usage ?? undefined;
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? undefined;
  const completionTokens =
    usage?.completion_tokens ?? usage?.output_tokens ?? undefined;
  const totalTokens = usage?.total_tokens ?? undefined;

  // Update centralized log with outcome
  await prisma.llmRequest.update({
    where: { id: req.id },
    data: {
      status: output ? "SUCCESS" : "ERROR",
      outputText: output ?? null,
      rawResponse: json,
      usage: usage ?? null,
      promptTokens: typeof promptTokens === "number" ? promptTokens : null,
      completionTokens:
        typeof completionTokens === "number" ? completionTokens : null,
      totalTokens: typeof totalTokens === "number" ? totalTokens : null,
      error: output ? null : "empty output",
    },
  });

  if (!output) {
    console.error(
      "[llm] empty output. raw=",
      JSON.stringify(json).slice(0, 800)
    );
  }
  return { output, raw: json };
}

function safeParseJson(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
const defaultChapterSummaryTemplate = [
  `You are a careful Bible study assistant producing concise, faithful summaries.`,
  `Summarize {{book}} {{chapter}} using ESV content provided as HTML. Do not paraphrase beyond clarity and accuracy.`,
  `Follow this format in HTML:`,
  `1) An overview table with columns: Chapter | Speaker(s) | Main Focus | Anchor Verses.`,
  `2) Detailed bullet sections per major scene or paragraph.`,
  `3) Character map presented as nested bullet lists (people → roles → relationships).`,
  `4) Key themes to trace (bullets).`,
  `5) Reflection questions (bullets).`,
  `End with a short prayer specific to {{book}} {{chapter}}.`,
  `Constraints: Keep quotes to short phrases with verse refs; avoid hallucinating cross-references.`,
  `Return only valid HTML snippet suitable for direct rendering (no <html> or <body>).`,
  `Passage HTML follows:\n\n{{{passageHtml}}}`,
].join("\n");

const defaultBookSummaryTemplate = [
  `You are a careful Bible study assistant producing concise, faithful summaries.`,
  `Write an overview of the biblical book: {{book}}.`,
  `Return valid HTML (no <html> or <body>), suitable for direct rendering.`,
  `Organize with clear headings and short paragraphs:`,
  `1) Summary (2–4 paragraphs) covering structure and flow.`,
  `2) Key characters (bullets: name — role, relationships, notable arcs).`,
  `3) Historical timing (approx. dating, setting, original audience).`,
  `4) Significance (theological themes, place in redemptive story).`,
  `Constraints: Be faithful to the text; avoid speculative claims.`,
].join("\n");
