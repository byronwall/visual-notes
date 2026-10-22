import { prisma } from "~/server/db";
import { MCP_CALL_EVENT_PREFIX } from "~/server/mcp/call-log";
import type { McpActivitySummary } from "~/services/activity/activity.types";

// Roll-up of `mcp.call.*` events for the Activity page's MCP section: who is
// connected, how much each client calls, and which tools they use.

const OAUTH_ACTOR_PREFIX = "chatgpt:";
const DEV_TOKEN_ACTOR = "chatgpt:dev-token";
const TOP_TOOLS = 12;

const isProblem = (eventType: string) => eventType !== "mcp.call.ok";

export async function summarizeMcpActivity(
  days: number,
): Promise<McpActivitySummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = {
    eventType: { startsWith: MCP_CALL_EVENT_PREFIX },
    createdAt: { gte: since },
  };
  const [byActor, byTool, grants] = await Promise.all([
    prisma.actionEvent.groupBy({
      by: ["actorId", "eventType"],
      where,
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.actionEvent.groupBy({
      by: ["entityId", "eventType"],
      where,
      _count: { _all: true },
    }),
    prisma.oAuthGrant.findMany({
      where: { revokedAt: null },
      select: { clientId: true, client: { select: { clientName: true } } },
    }),
  ]);

  const clientIds = new Set<string>();
  for (const row of byActor) {
    if (row.actorId?.startsWith(OAUTH_ACTOR_PREFIX)) {
      clientIds.add(row.actorId.slice(OAUTH_ACTOR_PREFIX.length));
    }
  }
  const clients = await prisma.oAuthClient.findMany({
    where: { id: { in: [...clientIds] } },
    select: { id: true, clientName: true },
  });
  const nameByActor = new Map<string, string>([
    [DEV_TOKEN_ACTOR, "Dev token"],
  ]);
  for (const client of clients) {
    if (client.clientName) {
      nameByActor.set(`${OAUTH_ACTOR_PREFIX}${client.id}`, client.clientName);
    }
  }
  // The dev token has no grant; it counts as connected while it is set.
  const connected = new Set<string>([DEV_TOKEN_ACTOR]);
  for (const grant of grants) {
    const actorId = `${OAUTH_ACTOR_PREFIX}${grant.clientId}`;
    connected.add(actorId);
    if (grant.client.clientName) {
      nameByActor.set(actorId, grant.client.clientName);
    }
  }

  const clientRows = new Map<string, McpActivitySummary["clients"][number]>();
  const clientRow = (actorId: string) => {
    let row = clientRows.get(actorId);
    if (!row) {
      row = {
        actorId,
        name: nameByActor.get(actorId) ?? actorId,
        calls: 0,
        problems: 0,
        lastCallAt: null,
        connected: connected.has(actorId),
      };
      clientRows.set(actorId, row);
    }
    return row;
  };
  for (const row of byActor) {
    const client = clientRow(row.actorId ?? "unknown");
    client.calls += row._count._all;
    if (isProblem(row.eventType)) client.problems += row._count._all;
    const last = row._max.createdAt?.toISOString() ?? null;
    if (last && (!client.lastCallAt || last > client.lastCallAt)) {
      client.lastCallAt = last;
    }
  }
  // Connected clients that have not called lately still belong in the list.
  for (const actorId of connected) {
    if (actorId !== DEV_TOKEN_ACTOR) clientRow(actorId);
  }

  const toolRows = new Map<string, { tool: string; calls: number; problems: number }>();
  for (const row of byTool) {
    const tool = row.entityId ?? "unknown";
    const entry = toolRows.get(tool) ?? { tool, calls: 0, problems: 0 };
    entry.calls += row._count._all;
    if (isProblem(row.eventType)) entry.problems += row._count._all;
    toolRows.set(tool, entry);
  }

  const allClients = [...clientRows.values()].sort(
    (a, b) =>
      b.calls - a.calls || Number(b.connected) - Number(a.connected),
  );
  const tools = [...toolRows.values()].sort((a, b) => b.calls - a.calls);
  return {
    days,
    calls: allClients.reduce((sum, row) => sum + row.calls, 0),
    problems: allClients.reduce((sum, row) => sum + row.problems, 0),
    toolCount: tools.length,
    clients: allClients,
    tools: tools.slice(0, TOP_TOOLS),
  };
}
