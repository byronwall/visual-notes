import { query } from "@solidjs/router";
import type { DocAudio } from "@prisma/client";
import { prisma } from "~/server/db";
import type { DocAudioSummary } from "./doc-audio.shared";

export const toDocAudioSummary = (row: DocAudio): DocAudioSummary => ({
  id: row.id,
  docId: row.docId,
  label: row.label,
  mimeType: row.mimeType,
  status: row.status,
  sizeBytes: row.sizeBytes,
  durationMs: row.durationMs,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const fetchDocAudios = query(
  async (docId: string): Promise<DocAudioSummary[]> => {
    "use server";
    const id = String(docId || "").trim();
    if (!id) return [];
    const rows = await prisma.docAudio.findMany({
      where: { docId: id },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDocAudioSummary);
  },
  "doc-audios-by-doc-id",
);
