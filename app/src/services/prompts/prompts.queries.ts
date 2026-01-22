import { query } from "@solidjs/router";
import { prisma } from "~/server/db";

export type Prompt = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
    modelOverride?: string | null;
    tempOverride?: number | null;
    topPOverride?: number | null;
  } | null;
};

export type PromptDetail = {
  id: string;
  task: string;
  description?: string | null;
  defaultModel: string;
  defaultTemp: number;
  defaultTopP?: number | null;
  activeVersionId?: string | null;
  activeVersion?: {
    id: string;
    template: string;
    system?: string | null;
    modelOverride?: string | null;
    tempOverride?: number | null;
    topPOverride?: number | null;
  } | null;
  versions: Array<{
    id: string;
    template: string;
    system?: string | null;
    modelOverride?: string | null;
    tempOverride?: number | null;
    topPOverride?: number | null;
    createdAt: string;
  }>;
};

export const fetchPrompts = query(async (): Promise<Prompt[]> => {
  "use server";
  const items = await prisma.prompt.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      activeVersion: true,
    },
  });
  console.log(`[services] fetchPrompts count=${items.length}`);
  return items.map((item) => ({
    id: item.id,
    task: item.task,
    description: item.description,
    defaultModel: item.defaultModel,
    defaultTemp: item.defaultTemp,
    defaultTopP: item.defaultTopP,
    activeVersion: item.activeVersion
      ? {
          id: item.activeVersion.id,
          template: item.activeVersion.template,
          system: item.activeVersion.system,
          modelOverride: item.activeVersion.modelOverride,
          tempOverride: item.activeVersion.tempOverride,
          topPOverride: item.activeVersion.topPOverride,
        }
      : null,
  }));
}, "prompts");

export const fetchPrompt = query(
  async (id: string): Promise<PromptDetail | null> => {
    "use server";
    if (!id) return null;
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: {
        activeVersion: true,
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!prompt) return null;
    console.log(`[services] fetchPrompt id=${id}`);
    return {
      id: prompt.id,
      task: prompt.task,
      description: prompt.description,
      defaultModel: prompt.defaultModel,
      defaultTemp: prompt.defaultTemp,
      defaultTopP: prompt.defaultTopP,
      activeVersionId: prompt.activeVersionId,
      activeVersion: prompt.activeVersion
        ? {
            id: prompt.activeVersion.id,
            template: prompt.activeVersion.template,
            system: prompt.activeVersion.system,
            modelOverride: prompt.activeVersion.modelOverride,
            tempOverride: prompt.activeVersion.tempOverride,
            topPOverride: prompt.activeVersion.topPOverride,
          }
        : null,
      versions: prompt.versions.map((v) => ({
        id: v.id,
        template: v.template,
        system: v.system,
        modelOverride: v.modelOverride,
        tempOverride: v.tempOverride,
        topPOverride: v.topPOverride,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  },
  "prompt"
);
