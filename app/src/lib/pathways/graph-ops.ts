import { ROOT_ID, type Feedback, type NodeKind, type NodeStatus, type PathwayGraph, type PathwayNode, type Research } from "./types";

/**
 * One batch of graph edits, used by the in-app agent and by MCP
 * `pathways_edit`. New nodes take a `ref` ("n1"); edges, merges, and updates
 * may name a ref or an existing id. Unknown ids are skipped, not errors.
 */
export type GraphOps = {
  nodes?: { ref: string; kind: Exclude<NodeKind, "root">; title: string; note?: string; missed?: boolean; research?: string }[];
  edges?: { from: string; to: string }[];
  removeEdges?: { from: string; to: string }[];
  /** Fold `drop` into `keep`: its edges move to `keep`, then it is deleted. */
  merges?: { keep: string; drop: string; title?: string | null }[];
  /** Mark dropped (kept on the map, faded). */
  drops?: string[];
  chosen?: string[];
  /** Append a line to a card's note, e.g. "Nov 9: Matt replied". */
  appendNotes?: { id: string; text: string }[];
  update?: {
    id: string;
    title?: string;
    note?: string;
    kind?: Exclude<NodeKind, "root">;
    status?: NodeStatus;
    weight?: "key" | "noise" | null;
    feedback?: Feedback | null;
    research?: Research | null;
  }[];
  remove?: string[];
};

export type OpsResult = {
  graph: PathwayGraph;
  /** New node ids, plus merge survivors. */
  added: string[];
  dropped: string[];
  /** Refs and ids that matched nothing. */
  skipped: string[];
};

export const newNodeId = () => Math.random().toString(36).slice(2, 8);

export function applyOps(graph: PathwayGraph, ops: GraphOps, by: "me" | "agent", makeId = newNodeId): OpsResult {
  const next: PathwayGraph = structuredClone(graph);
  const ids = new Map<string, string>(next.nodes.map((n) => [n.id, n.id]));
  const node = (ref: string) => next.nodes.find((n) => n.id === ids.get(ref));
  const added: string[] = [];
  const dropped: string[] = [];
  const skipped: string[] = [];
  const miss = (ref: string) => void skipped.push(ref);

  for (const n of ops.nodes ?? []) {
    if (!n.title.trim()) continue;
    const id = makeId();
    ids.set(n.ref, id);
    added.push(id);
    next.nodes.push({
      id,
      kind: n.kind,
      title: n.title.trim(),
      note: (n.note ?? "").trim(),
      by,
      status: "open",
      ...(n.missed ? { missed: true } : {}),
      ...(n.research?.trim() ? { research: { question: n.research.trim(), status: "suggested" as const } } : {}),
    });
  }

  for (const e of ops.edges ?? []) {
    const from = ids.get(e.from);
    const to = ids.get(e.to);
    if (from && to) next.edges.push({ from, to });
    else miss(from ? e.to : e.from);
  }

  for (const e of ops.removeEdges ?? []) {
    const from = ids.get(e.from);
    const to = ids.get(e.to);
    next.edges = next.edges.filter((x) => !(x.from === from && x.to === to));
  }

  for (const m of ops.merges ?? []) {
    const keep = ids.get(m.keep);
    const drop = ids.get(m.drop);
    if (!keep || !drop || keep === drop || drop === ROOT_ID) {
      miss(keep ? m.drop : m.keep);
      continue;
    }
    next.nodes = next.nodes.filter((n) => n.id !== drop);
    next.edges = next.edges.map((e) => ({ from: e.from === drop ? keep : e.from, to: e.to === drop ? keep : e.to }));
    ids.set(m.drop, keep);
    const kept = node(m.keep);
    if (kept && m.title) kept.title = m.title;
    added.push(keep);
  }

  const setStatus = (ref: string, status: NodeStatus) => {
    const n = node(ref);
    if (!n || n.id === ROOT_ID) return miss(ref);
    n.status = status;
    if (status === "dropped") dropped.push(n.id);
  };
  for (const ref of ops.drops ?? []) setStatus(ref, "dropped");
  for (const ref of ops.chosen ?? []) setStatus(ref, "chosen");

  for (const a of ops.appendNotes ?? []) {
    const n = node(a.id);
    if (!n) miss(a.id);
    else if (a.text.trim()) n.note = n.note ? `${n.note}\n${a.text.trim()}` : a.text.trim();
  }

  for (const u of ops.update ?? []) {
    const n = node(u.id);
    if (!n) {
      miss(u.id);
      continue;
    }
    if (u.title?.trim()) n.title = u.title.trim();
    if (u.note !== undefined) n.note = u.note;
    if (u.kind && n.kind !== "root") n.kind = u.kind;
    if (u.status && n.kind !== "root") n.status = u.status;
    setOptional(n, "weight", u.weight);
    setOptional(n, "feedback", u.feedback);
    setOptional(n, "research", u.research);
  }

  for (const ref of ops.remove ?? []) {
    const id = ids.get(ref);
    if (!id || id === ROOT_ID) {
      miss(ref);
      continue;
    }
    next.nodes = next.nodes.filter((n) => n.id !== id);
    next.edges = next.edges.filter((e) => e.from !== id && e.to !== id);
  }

  // No self-loops, no duplicate edges, no edges to deleted nodes.
  const live = new Set(next.nodes.map((n) => n.id));
  const seen = new Set<string>();
  next.edges = next.edges.filter((e) => {
    const k = `${e.from}>${e.to}`;
    if (e.from === e.to || seen.has(k) || !live.has(e.from) || !live.has(e.to)) return false;
    seen.add(k);
    return true;
  });
  return { graph: next, added: [...new Set(added)].filter((id) => live.has(id)), dropped, skipped };
}

/** `undefined` leaves the field alone; `null` clears it. */
function setOptional<K extends "weight" | "feedback" | "research">(n: PathwayNode, key: K, value: PathwayNode[K] | null | undefined) {
  if (value === undefined) return;
  if (value === null) delete n[key];
  else n[key] = value;
}
