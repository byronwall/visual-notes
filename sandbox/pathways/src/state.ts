import { createSignal } from "solid-js";
import { api } from "./api";
import type { AgentAction, Kind, MapInfo, PMap, PNode } from "./types";

// Module-level signals: the sandbox has one page and one open map.

export const [maps, setMaps] = createSignal<MapInfo[]>([]);
export const [map, setMap] = createSignal<PMap | null>(null);
export const [selected, setSelected] = createSignal<string | null>(null);
export const [linkFrom, setLinkFrom] = createSignal<string | null>(null);
/** Node id the agent is working on, or "map" for a whole-map action. */
export const [busy, setBusy] = createSignal<string | null>(null);
export const [summary, setSummary] = createSignal("");
export const [error, setError] = createSignal("");
export const [fresh, setFresh] = createSignal<Set<string>>(new Set());
export const [fitTick, setFitTick] = createSignal(0);

const newId = () => Math.random().toString(36).slice(2, 8);

const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err));

export async function refreshList() {
  setMaps(await api.list());
}

export async function openMap(id: string) {
  setError("");
  setSummary("");
  setSelected(null);
  setLinkFrom(null);
  setFresh(new Set<string>());
  setMap(await api.get(id));
  setFitTick((t) => t + 1);
  localStorage.setItem("pathways:last", id);
}

export async function createMap(title: string) {
  const m = await api.create(title);
  await refreshList();
  await openMap(m.id);
  setSelected("root");
}

/** Applies a local edit and saves the whole map. */
export function commit(edit: (m: PMap) => void) {
  const cur = map();
  if (!cur) return;
  const next = structuredClone(cur);
  edit(next);
  if (next.nodes.find((n) => n.id === "root")) next.title = next.nodes.find((n) => n.id === "root")!.title;
  setMap(next);
  api
    .save(next)
    .then((saved) => setMap((m) => (m?.id === saved.id ? { ...m, updatedAt: saved.updatedAt } : m)))
    .then(refreshList)
    .catch(fail);
}

export const updateNode = (id: string, patch: Partial<PNode>) =>
  commit((m) => Object.assign(m.nodes.find((n) => n.id === id)!, patch));

export function addChild(parent: string, kind: Kind) {
  const id = newId();
  const title = kind === "option" ? "New option" : kind === "outcome" ? "New outcome" : "New step";
  commit((m) => {
    m.nodes.push({ id, kind, title, note: "", by: "me", status: "open" });
    m.edges.push({ from: parent, to: id });
  });
  setSelected(id);
}

export function link(from: string, to: string) {
  if (from === to) return;
  commit((m) => {
    if (!m.edges.some((e) => e.from === from && e.to === to)) m.edges.push({ from, to });
  });
}

export const unlink = (from: string, to: string) =>
  commit((m) => {
    m.edges = m.edges.filter((e) => !(e.from === from && e.to === to));
  });

export function removeNode(id: string) {
  if (id === "root") return;
  commit((m) => {
    m.nodes = m.nodes.filter((n) => n.id !== id);
    m.edges = m.edges.filter((e) => e.from !== id && e.to !== id);
  });
  setSelected(null);
}

export async function runAgent(action: AgentAction, nodeId: string, hint: string) {
  const cur = map();
  if (!cur || busy()) return;
  setBusy(action === "converge" ? "map" : nodeId);
  setError("");
  try {
    const res = await api.agent(cur.id, action, nodeId, hint);
    setMap(res.map);
    setFresh(new Set(res.added));
    setSummary(res.summary);
    void refreshList();
  } catch (err) {
    fail(err);
  } finally {
    setBusy(null);
  }
}

export async function undo() {
  const cur = map();
  if (!cur) return;
  try {
    setMap(await api.undo(cur.id));
    setFresh(new Set<string>());
  } catch (err) {
    fail(err);
  }
}

// An outside agent (or another tab) edited the map file: reload it.
if (import.meta.hot) {
  import.meta.hot.on("pathways:changed", async ({ id }: { id: string }) => {
    void refreshList();
    const cur = map();
    if (!cur || cur.id !== id || busy()) return;
    const disk = await api.get(id);
    if (disk.updatedAt === map()?.updatedAt) return;
    const known = new Set(cur.nodes.map((n) => n.id));
    setFresh(new Set(disk.nodes.filter((n) => !known.has(n.id)).map((n) => n.id)));
    setMap(disk);
  });
}
