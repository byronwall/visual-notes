import type {
  McpServer,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Prisma } from "@prisma/client";
import { type z, ZodError } from "zod";
import { ResearchIngestError } from "~/services/research/research.ingest";
import { TimeBlockInputError } from "~/server/time-blocks/time-block-store";
import {
  ConnectorError,
  nothingWritten,
  type ConnectorContext,
} from "./shared";

// One way to declare a connector tool. Every family registers through
// `tools.read` / `tools.write`, which set the scope, the annotations, the
// logging, and how failures become refusals, so no tool repeats them.

const LOG_PREFIX = "[mcp]";

export const READ_SCOPE = "notes:read";
export const WRITE_SCOPE = "notes:write";

/** The scope a listed tool needs, from its annotations. */
export const scopeForAnnotations = (annotations?: {
  readOnlyHint?: boolean;
}) => (annotations?.readOnlyHint ? READ_SCOPE : WRITE_SCOPE);

type ToolSpec<S extends z.ZodRawShape> = {
  title: string;
  description: string;
  input?: S;
  /** Hides or removes something (still undoable). */
  destructive?: boolean;
  /** Repeating the same call leaves the same result. */
  idempotent?: boolean;
  /** Reaches a service outside the app. */
  openWorld?: boolean;
};

/** Every tool answers with a JSON object; lists sit under a named key. */
type Handler<S extends z.ZodRawShape> = (
  args: z.objectOutputType<S, z.ZodTypeAny>,
) => Promise<Record<string, unknown>>;

export type ToolRegistrar = {
  ctx: ConnectorContext;
  read<S extends z.ZodRawShape = {}>(
    name: string,
    spec: ToolSpec<S>,
    handler: Handler<S>,
  ): void;
  write<S extends z.ZodRawShape = {}>(
    name: string,
    spec: ToolSpec<S>,
    handler: Handler<S>,
  ): void;
};

/** Plain store errors, as opposed to Prisma or runtime failures. */
const isPlainError = (error: unknown): error is Error =>
  error instanceof Error && error.constructor === Error;

/** Turns what the stores throw for bad input into a refusal the agent can fix. */
export function toRefusal(error: unknown): ConnectorError | null {
  if (error instanceof ConnectorError) return error;
  if (error instanceof ZodError) {
    return new ConnectorError(
      "invalid",
      error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  if (error instanceof ResearchIngestError) {
    return new ConnectorError("invalid", nothingWritten(error.issues));
  }
  if (error instanceof TimeBlockInputError) {
    return new ConnectorError("invalid", error.message);
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return new ConnectorError("not_found", "Record not found");
  }
  if (isPlainError(error)) {
    if (/not found/i.test(error.message)) {
      return new ConnectorError("not_found", error.message);
    }
    if (/invalid|cannot/i.test(error.message)) {
      return new ConnectorError("invalid", error.message);
    }
  }
  return null;
}

export async function runTool(
  tool: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    console.info(`${LOG_PREFIX} ${tool} ok in ${Date.now() - startedAt}ms`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (error) {
    const refusal = toRefusal(error);
    if (refusal) {
      console.info(`${LOG_PREFIX} ${tool} refused: ${refusal.code}`);
      return {
        isError: true,
        content: [
          { type: "text", text: `${refusal.code}: ${refusal.message}` },
        ],
      };
    }
    console.error(`${LOG_PREFIX} ${tool} failed`, error);
    return {
      isError: true,
      content: [
        { type: "text", text: "Internal error while handling the request." },
      ],
    };
  }
}

/** ChatGPT shows its account-linking UI only for this result shape. */
function insufficientScope(
  ctx: ConnectorContext,
  scope: string,
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `This action needs the ${scope} permission. Reconnect Visual Notes to grant it.`,
      },
    ],
    _meta: { "mcp/www_authenticate": [ctx.scopeChallenge] },
  };
}

export function createToolRegistrar(
  server: McpServer,
  ctx: ConnectorContext,
): ToolRegistrar {
  const register =
    (readOnly: boolean) =>
    <S extends z.ZodRawShape>(
      name: string,
      spec: ToolSpec<S>,
      handler: Handler<S>,
    ) => {
      const scope = readOnly ? READ_SCOPE : WRITE_SCOPE;
      const callback = (args: z.objectOutputType<S, z.ZodTypeAny>) => {
        if (!ctx.scopes.includes(scope)) {
          console.info(`${LOG_PREFIX} ${name} refused: missing ${scope}`);
          return insufficientScope(ctx, scope);
        }
        return runTool(name, () => handler(args));
      };
      server.registerTool(
        name,
        {
          title: spec.title,
          description: spec.description,
          inputSchema: spec.input ?? ({} as S),
          annotations: {
            readOnlyHint: readOnly,
            destructiveHint: spec.destructive ?? false,
            idempotentHint: spec.idempotent ?? readOnly,
            openWorldHint: spec.openWorld ?? false,
          },
        },
        callback as unknown as ToolCallback<S>,
      );
    };
  return { ctx, read: register(true), write: register(false) };
}
