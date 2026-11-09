import { createMemo, createSignal } from "solid-js";
import { api } from "./api";
import type { AgentAction, Kind, MapContext, MapInfo, PMap, PNode, Research } from "./types";

// Module-level signals: the sandbox has one page and one open map.

export const [maps, setMaps] = createSignal<MapInfo[]>([]);
export const [map, setMap] = createSignal<PMap | null>(null);
export const [selected, setSelected] = createSignal<string | null>(null);
export const [linkFrom, setLinkFrom] = createSignal<string | null>(null);
/** Node id the agent is working on, "research:<id>" for web research, or "map" for a whole-map action. */
export const [busy, setBusy] = createSignal<string | null>(null);
export const [error, setError] = createSignal("");
export const [fitTick, setFitTick] = createSignal(0);

/** What the last agent run (or outside edit) changed. Stays until the next change or dismiss. */
export type Change = {
  label: string;
  summary: string;
  ms?: number;
  added: string[];
  joined: string[];
  removed: string[];
  retitled: string[];
  newEdges: string[];
  dropped?: string[];
  questions?: number;
};
export const [change, setChange] = createSignal<Change | null>(null);
export const freshNodes = createMemo(() => new Set([...(change()?.added ?? []), ...(change()?.joined ?? [])]));
export const freshEdges = createMemo(() => new Set(change()?.newEdges ?? []));

const newId = () => Math.random().toString(36).slice(2, 8);
const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err));

/** Compares two versions of a map for the "what changed" card. */
function diff(before: PMap, after: PMap, label: string, summary: string, ms?: number): Change {
  const old = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Set(after.nodes.map((n) => n.id));
  const oldEdges = new Set(before.edges.map(edgeKey));
  const newEdges = after.edges.filter((e) => !oldEdges.has(edgeKey(e)));
  const added = after.nodes.filter((n) => !old.has(n.id)).map((n) => n.id);
  return {
    label,
    summary,
    ms,
    added,
    // Existing nodes that a new edge now reaches: this is where paths meet.
    joined: [...new Set(newEdges.map((e) => e.to).filter((id) => old.has(id)))],
    removed: before.nodes.filter((n) => !now.has(n.id)).map((n) => n.title),
    retitled: after.nodes.filter((n) => old.has(n.id) && old.get(n.id)!.title !== n.title).map((n) => n.id),
    newEdges: newEdges.map(edgeKey),
  };
}

export async function refreshList() {
  setMaps(await api.list());
}

export async function openMap(id: string) {
  setError("");
  setChange(null);
  setSelected(null);
  setLinkFrom(null);
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
  const root = next.nodes.find((n) => n.id === "root");
  if (root) next.title = root.title;
  setMap(next);
  api
    .save(next)
    .then((saved) => setMap((m) => (m?.id === saved.id ? { ...m, updatedAt: saved.updatedAt } : m)))
    .then(refreshList)
    .catch(fail);
}

export const updateNode = (id: string, patch: Partial<PNode>) =>
  commit((m) => Object.assign(m.nodes.find((n) => n.id === id)!, patch));

export const updateContext = (edit: (c: MapContext) => void) =>
  commit((m) => {
    m.context ??= { notes: "", qa: [] };
    edit(m.context);
  });

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

const ACTION_LABEL: Record<AgentAction, string> = {
  options: "What are my options?",
  forward: "Play it forward",
  converge: "Where do paths meet?",
  questions: "Ask me about my goals",
  improve: "Improve from feedback",
  regenerate: "Fresh map from feedback",
};

const MAP_WIDE: AgentAction[] = ["converge", "questions", "improve", "regenerate"];

export async function runAgent(action: AgentAction, nodeId: string, hint: string) {
  const cur = map();
  if (!cur || busy()) return;
  setBusy(MAP_WIDE.includes(action) ? "map" : nodeId);
  setError("");
  setChange(null);
  try {
    const res = await api.agent(cur.id, action, nodeId, hint);
    const target = cur.nodes.find((n) => n.id === nodeId)?.title ?? "";
    const label = MAP_WIDE.includes(action) ? ACTION_LABEL[action] : `${ACTION_LABEL[action]} · ${target}`;
    // A fresh map is a new map: compare it with an empty one so every node reads as new.
    const base = res.map.id === cur.id ? cur : { ...res.map, nodes: res.map.nodes.filter((n) => n.id === "root"), edges: [] };
    const c = diff(base, res.map, label, res.summary, res.ms);
    c.dropped = res.dropped ?? [];
    if (res.map.id !== cur.id) {
      setSelected(null);
      localStorage.setItem("pathways:last", res.map.id);
    }
    if (action === "questions") c.questions = (res.map.context?.qa.length ?? 0) - (cur.context?.qa.length ?? 0);
    setMap(res.map);
    setChange(c);
    setFitTick((t) => t + 1);
    void refreshList();
  } catch (err) {
    fail(err);
  } finally {
    setBusy(null);
  }
}

export const setResearch = (id: string, research: Research | undefined) => updateNode(id, { research });

export async function runResearch(nodeId: string) {
  const cur = map();
  if (!cur || busy()) return;
  setBusy(`research:${nodeId}`);
  setError("");
  try {
    const res = await api.research(cur.id, nodeId);
    setMap(res.map);
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
    setChange(null);
  } catch (err) {
    fail(err);
  }
}

// An outside agent (or another tab) edited the map file: reload it and show the change.
if (import.meta.hot) {
  import.meta.hot.on("pathways:changed", async ({ id }: { id: string }) => {
    void refreshList();
    const cur = map();
    if (!cur || cur.id !== id || busy()) return;
    const disk = await api.get(id);
    if (disk.updatedAt === map()?.updatedAt) return;
    const c = diff(cur, disk, "Outside edit", "");
    if (c.added.length || c.newEdges.length || c.removed.length) setChange(c);
    setMap(disk);
  });
}
