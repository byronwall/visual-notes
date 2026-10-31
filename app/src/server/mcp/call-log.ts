import { prisma } from "~/server/db";
import { logActionEvent } from "~/server/events/action-events";
import type { ConnectorContext } from "./shared";

// The connector's own activity: one `mcp.call.<outcome>` event per tool call,
// recorded by the registrar so no tool family logs it. The tool name is the
// event's entityId and the call id its requestId; every domain event a write
// logs during the call carries the same requestId (see event-scope.ts), which
// is how the Activity page shows what a call changed.

export type McpCallOutcome = "ok" | "refused" | "failed" | "denied";

export const MCP_CALL_EVENT_PREFIX = "mcp.call.";
export const MCP_TOOL_ENTITY = "mcp_tool";

export type McpCallRecord = {
  ctx: ConnectorContext;
  callId: string;
  tool: string;
  /** Left out when the SDK refused the arguments before the tool ran. */
  kind?: "read" | "write";
  outcome: McpCallOutcome;
  durationMs: number;
  args: unknown;
  /** Refusal code (not_found, invalid, …) or the missing scope. */
  code?: string;
  message?: string;
};

const MAX_STRING = 60;
const MAX_ARRAY = 3;
const MAX_ARGS = 240;

/** Arguments trimmed to what identifies the call: no full note bodies. */
export function summarizeArgs(args: unknown): string | null {
  const trim = (value: unknown, depth: number): unknown => {
    if (typeof value === "string") {
      return value.length > MAX_STRING
        ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)`
        : value;
    }
    if (Array.isArray(value)) {
      const head = value.slice(0, MAX_ARRAY).map((v) => trim(v, depth + 1));
      return value.length > MAX_ARRAY
        ? [...head, `…${value.length - MAX_ARRAY} more`]
        : head;
    }
    if (value && typeof value === "object") {
      if (depth > 1) return "{…}";
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, trim(v, depth + 1)]),
      );
    }
    return value;
  };
  const trimmed = trim(args, 0);
  if (
    !trimmed ||
    (typeof trimmed === "object" && Object.keys(trimmed).length === 0)
  ) {
    return null;
  }
  const text = JSON.stringify(trimmed);
  return text.length > MAX_ARGS ? `${text.slice(0, MAX_ARGS)}…` : text;
}

/** Never throws: a logging failure must not change the tool's answer. */
export async function recordMcpCall(record: McpCallRecord): Promise<void> {
  try {
    const changes =
      record.kind === "write" && record.outcome === "ok"
        ? await prisma.actionEvent.count({
            where: {
              requestId: record.callId,
              NOT: { eventType: { startsWith: MCP_CALL_EVENT_PREFIX } },
            },
          })
        : null;
    await logActionEvent({
      eventType: `${MCP_CALL_EVENT_PREFIX}${record.outcome}`,
      entityType: MCP_TOOL_ENTITY,
      entityId: record.tool,
      context: {
        actorId: record.ctx.actorId,
        actorType: "chatgpt",
        requestId: record.callId,
      },
      payload: {
        tool: record.tool,
        kind: record.kind,
        durationMs: record.durationMs,
        agent: record.ctx.clientName ?? null,
        args: summarizeArgs(record.args),
        code: record.code ?? null,
        message: record.message?.slice(0, 200) ?? null,
        changes,
      },
    });
  } catch (error) {
    console.warn("[mcp] call log failed", record.tool, error);
  }
}
