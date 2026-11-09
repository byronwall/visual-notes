import type { AgentAction, AgentResult, MapInfo, PMap } from "./types";

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  list: () => call<MapInfo[]>("/api/maps"),
  get: (id: string) => call<PMap>(`/api/maps/${id}`),
  create: (title: string) => call<PMap>("/api/maps", "POST", { title }),
  save: (map: PMap) => call<PMap>(`/api/maps/${map.id}`, "PUT", map),
  undo: (id: string) => call<PMap>(`/api/maps/${id}/undo`, "POST"),
  agent: (id: string, action: AgentAction, nodeId: string, hint: string) =>
    call<AgentResult>(`/api/maps/${id}/agent`, "POST", { action, nodeId, hint }),
};
