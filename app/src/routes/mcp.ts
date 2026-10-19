import type { APIEvent } from "@solidjs/start/server";
import { handleMcpRequest } from "~/server/mcp/handler";

// ChatGPT MCP connector endpoint (Streamable HTTP, stateless).
export const POST = (event: APIEvent) => handleMcpRequest(event.request);
export const GET = (event: APIEvent) => handleMcpRequest(event.request);
export const DELETE = (event: APIEvent) => handleMcpRequest(event.request);
