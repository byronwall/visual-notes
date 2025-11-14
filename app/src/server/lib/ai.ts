import { prisma } from "~/server/db";

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
