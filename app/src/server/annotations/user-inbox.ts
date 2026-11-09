import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { publishAppChange } from "~/server/note-events";
import type {
  AgentRun,
  InboxItem,
  InboxPlace,
  UserInbox,
  WaitingItem,
} from "~/lib/annotations/inbox-types";
import { toAnnotationView } from "./annotations";
import { toView as toProposalView } from "./proposals";

// Your side of the inbox: what agents did that needs you, what is still with
// the agents, and a compact log of agent runs. Everything an agent writes
// shows somewhere here; the back-and-forth sits on top.

const RUN_WINDOW_DAYS = 7;
/** Calls closer together than this belong to one agent run. */
const RUN_GAP_MS = 30 * 60 * 1000;
const MAX_RUNS = 30;

const include = {
  type: true,
  messages: { orderBy: { createdAt: "asc" as const } },
  doc: { select: { id: true, title: true } },
  task: { select: { id: true, description: true, listId: true } },
};

type Row = Prisma.AnnotationGetPayload<{ include: typeof include }>;

const placeOf = (row: Row): InboxPlace =>
  row.task
    ? { kind: "task", taskId: row.task.id, listId: row.task.listId, title: row.task.description }
    : { kind: "note", docId: row.doc!.id, title: row.doc!.title, blockId: row.blockId };

const seenBefore = (seenAt: Date | null, at: Date | null) => Boolean(at && (!seenAt || at > seenAt));

export async function loadUserInbox(options: { runs?: boolean } = {}): Promise<UserInbox> {
  const rows = await prisma.annotation.findMany({
    where: {
      OR: [
        { status: { in: ["open", "claimed", "ready"] } },
        { author: { not: "you" }, seenAt: null },
      ],
    },
    include,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const needsYou: InboxItem[] = [];
  const waiting: WaitingItem[] = [];
  for (const row of rows) {
    if (!row.doc && !row.task) continue;
    const base = {
      place: placeOf(row),
      typeName: row.type.name,
      color: row.type.color,
      annotation: toAnnotationView(row),
    };
    if (row.status === "ready") {
      needsYou.push({ reason: "ready", at: (row.readyAt ?? row.updatedAt).toISOString(), ...base });
    } else if (row.author !== "you") {
      needsYou.push({ reason: "agent-note", at: row.createdAt.toISOString(), ...base });
    } else if (seenBefore(row.seenAt, row.lastAgentAt) && row.messages.at(-1)?.author !== "you") {
      // An agent replied without marking it ready, often a question for you.
      needsYou.push({ reason: "agent-reply", at: row.lastAgentAt!.toISOString(), ...base });
    } else {
      waiting.push({ at: row.createdAt.toISOString(), ...base });
    }
  }

  const proposals = await prisma.editProposal.findMany({
    where: { resolvedAt: null },
    include: { doc: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  for (const proposal of proposals) {
    const view = toProposalView(proposal);
    needsYou.push({
      reason: "proposal",
      at: view.createdAt,
      place: {
        kind: "note",
        docId: proposal.doc.id,
        title: proposal.doc.title,
        blockId: view.ops.find((op) => op.state === "pending")?.blockId ?? null,
      },
      proposal: view,
    });
  }

  const comments = await prisma.researchComment.findMany({
    where: { resolvedAt: { not: null }, seenAt: null },
    include: { topic: { select: { slug: true, title: true } }, card: { select: { title: true } } },
    orderBy: { resolvedAt: "desc" },
    take: 50,
  });
  for (const comment of comments) {
    needsYou.push({
      reason: "research",
      at: comment.resolvedAt!.toISOString(),
      commentId: comment.id,
      topicSlug: comment.topic.slug,
      topicTitle: comment.topic.title,
      cardTitle: comment.card?.title ?? null,
      body: comment.body,
      resolution: comment.resolution,
    });
  }

  needsYou.sort((a, b) => b.at.localeCompare(a.at));
  const runs = options.runs === false ? [] : await loadAgentRuns();
  return { generatedAt: new Date().toISOString(), needsYou, waiting, runs };
}

/** How many items wait on you, for the sidebar badge. */
export async function countNeedsYou(): Promise<number> {
  return (await loadUserInbox({ runs: false })).needsYou.length;
}

/** Groups the MCP call log into runs: one agent, calls less than 30 minutes apart. */
export async function loadAgentRuns(): Promise<AgentRun[]> {
  const since = new Date(Date.now() - RUN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const calls = await prisma.actionEvent.findMany({
    where: { eventType: { startsWith: "mcp.call." }, createdAt: { gte: since } },
    select: { createdAt: true, eventType: true, payload: true, actorId: true },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const open = new Map<string, AgentRun & { last: number; counts: Map<string, number> }>();
  const done: AgentRun[] = [];
  const close = (run: AgentRun & { counts: Map<string, number> }) => {
    done.push({
      agent: run.agent,
      start: run.start,
      end: run.end,
      calls: run.calls,
      writes: run.writes,
      problems: run.problems,
      tools: [...run.counts].sort((a, b) => b[1] - a[1]).map(([tool, count]) => ({ tool, calls: count })),
    });
  };
  for (const call of calls) {
    const payload = (call.payload ?? {}) as { agent?: string | null; tool?: string; kind?: string; changes?: number | null };
    const agent = payload.agent || call.actorId || "Agent";
    const at = call.createdAt.getTime();
    let run = open.get(agent);
    if (run && at - run.last > RUN_GAP_MS) {
      close(run);
      run = undefined;
    }
    if (!run) {
      run = { agent, start: call.createdAt.toISOString(), end: "", calls: 0, writes: 0, problems: 0, tools: [], last: at, counts: new Map() };
      open.set(agent, run);
    }
    run.calls += 1;
    run.last = at;
    run.end = call.createdAt.toISOString();
    if (payload.kind === "write" && call.eventType === "mcp.call.ok") run.writes += 1;
    if (call.eventType !== "mcp.call.ok") run.problems += 1;
    if (payload.tool) run.counts.set(payload.tool, (run.counts.get(payload.tool) ?? 0) + 1);
  }
  for (const run of open.values()) close(run);
  return done.sort((a, b) => b.end.localeCompare(a.end)).slice(0, MAX_RUNS);
}

/** Marks an item seen, so it leaves "Needs you" until an agent works on it again. */
export async function dismissInboxItem(input: { kind: "annotation" | "research"; id: string }) {
  if (input.kind === "research") {
    await prisma.researchComment.update({ where: { id: input.id }, data: { seenAt: new Date() } });
  } else {
    await prisma.annotation.update({ where: { id: input.id }, data: { seenAt: new Date() } });
  }
  publishAppChange("inbox", null);
}
