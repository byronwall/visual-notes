import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/server/db";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") || "50"))
  );
  const promptId = url.searchParams.get("promptId") || undefined;
  const versionId = url.searchParams.get("versionId") || undefined;
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
    `[api/ai/runs] GET count=${runs.length} promptId=${promptId || ""} versionId=${
      versionId || ""
    }`
  );
  const items = runs.map((r) => ({
    id: r.id,
    status: r.status,
    model: r.model,
    createdAt: r.createdAt,
    error: r.error,
    promptVersionId: r.promptVersionId,
    compiledPrompt: r.compiledPrompt,
    systemUsed: r.systemUsed,
    outputHtml: r.outputHtml,
    rawResponse: r.rawResponse,
    inputVars: r.inputVars,
    promptId: r.promptVersion?.Prompt?.id ?? null,
    promptTask: r.promptVersion?.Prompt?.task ?? null,
    versionId: r.promptVersion?.id ?? null,
  }));
  return json({ items });
}


