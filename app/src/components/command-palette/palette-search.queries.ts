import { query } from "@solidjs/router";
import { prisma } from "~/server/db";
import { searchArchivedPages } from "~/server/archive/archive-store";
import { queryTasks } from "~/server/tasks/task-store";
import { isDoneStatus } from "~/components/tasks/taskFormat";
import type { TaskStatus } from "~/services/tasks/tasks.types";

export type PaletteGroups = {
  tasks: { id: string; description: string; listId: string; listName: string; status: TaskStatus }[];
  topics: { id: string; slug: string; title: string }[];
  pages: { id: string; title: string; hostname: string | null }[];
};

const GROUP_LIMIT = 5;

/**
 * Tasks, research topics, and saved pages for Cmd+K, matched by the same plain
 * words as the MCP `search` tool. A research card hit lists its topic, and
 * topics with the words in their title come first.
 */
export const searchPaletteGroups = query(
  async (q: string): Promise<PaletteGroups> => {
    "use server";
    const lower = q.trim().toLowerCase();
    // `contains` is LIKE, so "_" and "%" must not act as wildcards.
    const text = q.trim().replace(/[\\%_]/g, "\\$&");
    const contains = { contains: text, mode: "insensitive" as const };
    const [tasks, topics, pages] = await Promise.all([
      queryTasks({ text, limit: 25 }),
      prisma.researchTopic.findMany({
        where: {
          archivedAt: null,
          OR: [
            { title: contains },
            {
              cards: {
                some: {
                  hiddenAt: null,
                  OR: [
                    { title: contains },
                    { body: contains },
                    { snippet: contains },
                    { url: contains },
                  ],
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, slug: true, title: true },
      }),
      searchArchivedPages({ text, limit: GROUP_LIMIT }),
    ]);
    const inTitle = (title: string) => (title.toLowerCase().includes(lower) ? 0 : 1);
    return {
      tasks: tasks
        .map((task) => ({
          id: task.id,
          description: task.description,
          listId: task.listId,
          listName: task.list.name,
          status: task.status as TaskStatus,
        }))
        // Open tasks first, so old finished ones can't fill the group.
        .sort((a, b) => Number(isDoneStatus(a.status)) - Number(isDoneStatus(b.status)))
        .slice(0, GROUP_LIMIT),
      topics: topics
        .sort((a, b) => inTitle(a.title) - inTitle(b.title))
        .slice(0, GROUP_LIMIT),
      pages: pages.map(({ id, title, hostname }) => ({ id, title, hostname })),
    };
  },
  "palette-search",
);
