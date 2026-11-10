import { useNavigate, useSearchParams } from "@solidjs/router";
import { createContext, createMemo, createSignal, useContext } from "solid-js";
import { applyOps, newNodeId, type GraphOps } from "~/lib/pathways/graph-ops";
import { ROOT_ID } from "~/lib/pathways/types";
import type {
  NodeKind,
  PathwayContext,
  PathwayNode,
  PlanTask,
  Research,
} from "~/lib/pathways/types";
import type { PathwayView as PathwayRecord } from "~/server/pathways/pathway-tasks";
import type { PathwayAgentAction } from "~/server/pathways/agent-prompts";
import {
  editPathway,
  exportPlanTasksFn,
  updatePlanTaskFn,
  runPathwayAgentFn,
  runPathwayResearchFn,
  setPathwayContext,
  splitPathwayFn,
  undoPathwayFn,
} from "~/services/pathways/pathways.actions";

/** What the last agent run (or outside edit) changed. Stays until the next change or dismiss. */
export type Change = {
  label: string;
  summary: string;
  ms?: number;
  added: string[];
  joined: string[];
  removed: string[];
  newEdges: string[];
  dropped?: string[];
  steer?: string;
  questions?: number;
  planned?: number;
};

export const ACTION_LABEL: Record<PathwayAgentAction, string> = {
  start: "First map",
  options: "More choices from here",
  forward: "What happens next",
  converge: "Where do paths meet?",
  questions: "Ask me about my goals",
  improve: "Improve from feedback",
  regenerate: "Fresh map from feedback",
  plan: "Plan next steps",
  absorb: "Update map from what happened",
  fromResearch: "Add research to map",
};
const MAP_WIDE: PathwayAgentAction[] = [
  "converge",
  "questions",
  "improve",
  "regenerate",
  "plan",
  "absorb",
];

export type PanelTab = "map" | "next" | "activity";

const edgeKey = (e: { from: string; to: string }) => `${e.from}>${e.to}`;

/** Compares two versions of a map for the "what changed" card. */
function diff(
  before: PathwayRecord,
  after: PathwayRecord,
  label: string,
  summary: string,
  ms?: number,
): Change {
  const old = new Map(before.graph.nodes.map((n) => [n.id, n]));
  const now = new Set(after.graph.nodes.map((n) => n.id));
  const oldEdges = new Set(before.graph.edges.map(edgeKey));
  const newEdges = after.graph.edges.filter((e) => !oldEdges.has(edgeKey(e)));
  return {
    label,
    summary,
    ms,
    added: after.graph.nodes.filter((n) => !old.has(n.id)).map((n) => n.id),
    // Existing cards a new edge now reaches: this is where paths meet.
    joined: [...new Set(newEdges.map((e) => e.to).filter((id) => old.has(id)))],
    removed: before.graph.nodes
      .filter((n) => !now.has(n.id))
      .map((n) => n.title),
    newEdges: newEdges.map(edgeKey),
  };
}

/**
 * Page state for one open pathway. Edits apply locally at once, then the
 * server's record replaces the local copy. Created per page, so SSR
 * requests never share it.
 */
export function createPathwayState(initial: PathwayRecord) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams<{
    node?: string;
    view?: string;
    draft?: string;
  }>();
  const [record, setRecord] = createSignal(initial);
  const [linkFrom, setLinkFrom] = createSignal<string | null>(null);
  /** Card id the agent works on, "research:<id>" (web search), "research-map:<id>" (findings to cards), or "map". */
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [change, setChange] = createSignal<Change | null>(null);
  const [steer, setSteer] = createSignal("");
  const [fitTick, setFitTick] = createSignal(0);
  const [titleFocus, setTitleFocus] = createSignal(0);

  // Selection and view live in the URL, so a refresh keeps them.
  const selected = () => params.node ?? null;
  const setSelected = (id: string | null) => {
    if (id !== selected()) setSteer("");
    setParams({ node: id ?? undefined }, { replace: true });
  };
  /** Selects a card and shows it in the side panel, in one URL update. */
  const openCard = (id: string) => {
    if (id !== selected()) setSteer("");
    setParams({ node: id, view: undefined }, { replace: true });
  };
  /** The side panel's tab: the selected card (or overview), Next steps, or Activity. */
  const view = (): PanelTab =>
    params.view === "next" || params.view === "activity" ? params.view : "map";
  const setView = (v: PanelTab) => {
    if (v === view()) return;
    setSteer("");
    setParams({ view: v === "map" ? undefined : v }, { replace: true });
  };

  const freshNodes = createMemo(
    () => new Set([...(change()?.added ?? []), ...(change()?.joined ?? [])]),
  );
  const freshEdges = createMemo(() => new Set(change()?.newEdges ?? []));
  const fail = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[pathways] action failed", msg);
    // The agent's provider errors arrive as raw JSON; say what it means.
    if (/OpenAI 401/.test(msg))
      return setError("The agent can't run: OpenAI rejected the API key.");
    if (/OpenAI (429|5\d\d)/.test(msg))
      return setError(
        "The agent can't run right now: OpenAI is busy or down. Try again in a minute.",
      );
    setError(msg);
  };

  /** Saves through the server and swaps in its record (the local copy already shows the edit). */
  // Only the newest save's reply is taken: an older reply that arrives later
  // would put back a map without the edits made since.
  let saves = 0;
  let inFlight = 0;
  const save = (p: Promise<PathwayRecord | null>) => {
    const n = ++saves;
    inFlight++;
    return p
      .then((r) => r && n === saves && setRecord(r))
      .catch(fail)
      .finally(() => inFlight--);
  };

  /** `coalesce` names a text field, so a typing burst is one undo step. */
  const edit = (ops: GraphOps, coalesce?: string) => {
    setRecord((r) => ({ ...r, graph: applyOps(r.graph, ops, "me").graph }));
    save(editPathway({ id: record().id, ops, coalesce }));
  };
  type NodePatch = Omit<NonNullable<GraphOps["update"]>[number], "id">;
  const updateNode = (id: string, patch: NodePatch, coalesce?: string) =>
    edit({ update: [{ id, ...patch }] }, coalesce);

  const setContext = (fn: (c: PathwayContext) => void, coalesce?: string) => {
    const next = structuredClone(record().context ?? { notes: "", qa: [] });
    fn(next);
    setRecord((r) => ({ ...r, context: next }));
    save(setPathwayContext({ id: record().id, context: next, coalesce }));
  };

  const addChild = (parent: string, kind: Exclude<NodeKind, "root">) => {
    const title =
      kind === "option"
        ? "New option"
        : kind === "outcome"
          ? "New outcome"
          : "New step";
    // The id is picked here and sent along, so the card can be selected at once.
    const id = newNodeId();
    const ops: GraphOps = {
      nodes: [{ ref: "n", kind, title }],
      edges: [{ from: parent, to: "n" }],
    };
    setRecord((r) => ({
      ...r,
      graph: applyOps(r.graph, ops, "me", () => id).graph,
    }));
    save(editPathway({ id: record().id, ops, newIds: [id] }));
    setSelected(id);
    setTitleFocus((t) => t + 1);
  };

  const link = (from: string, to: string) =>
    from !== to && edit({ edges: [{ from, to }] });
  const unlink = (from: string, to: string) =>
    edit({ removeEdges: [{ from, to }] });
  const removeNode = (id: string) => {
    if (id === "root") return;
    edit({ remove: [id] });
    setSelected(null);
  };
  const setResearch = (id: string, research: Research | undefined) =>
    edit({ update: [{ id, research: research ?? null }] });

  const runAgent = async (
    asked: PathwayAgentAction,
    nodeId: string,
    hint = steer(),
  ) => {
    const cur = record();
    // A map that is only its question gets a whole first map (the server
    // makes the same call); name the run for what it does.
    const action =
      asked === "options" && nodeId === ROOT_ID && cur.graph.nodes.length === 1
        ? "start"
        : asked;
    if (busy()) return;
    setBusy(
      MAP_WIDE.includes(action)
        ? "map"
        : action === "fromResearch"
          ? `research-map:${nodeId}`
          : nodeId,
    );
    setError("");
    setChange(null);
    try {
      const res = await runPathwayAgentFn({ id: cur.id, action, nodeId, hint });
      const target = cur.graph.nodes.find((n) => n.id === nodeId)?.title ?? "";
      const label = MAP_WIDE.includes(action)
        ? ACTION_LABEL[action]
        : `${ACTION_LABEL[action]} · ${target}`;
      if (res.record.id !== cur.id) {
        // A fresh map is a new map: open it.
        navigate(`/pathways/${res.record.id}`);
        return;
      }
      const c = diff(cur, res.record, label, res.summary, res.ms);
      c.dropped = res.dropped;
      if (hint.trim()) c.steer = hint.trim();
      if (action === "questions")
        c.questions =
          (res.record.context?.qa.length ?? 0) - (cur.context?.qa.length ?? 0);
      if (action === "plan")
        c.planned =
          res.record.plan?.tasks.filter((t) => t.status === "todo").length ?? 0;
      setRecord(res.record);
      setChange(c);
      setSteer("");
      setFitTick((t) => t + 1);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const runResearch = async (nodeId: string) => {
    if (busy()) return;
    setBusy(`research:${nodeId}`);
    setError("");
    try {
      setRecord(await runPathwayResearchFn({ id: record().id, nodeId }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  /** Opens a new map with this card as its question; this map stays as it is. */
  const split = async (nodeId: string) => {
    setBusy(nodeId);
    try {
      const r = await splitPathwayFn({ id: record().id, nodeId });
      navigate(`/pathways/${r.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    try {
      const r = await undoPathwayFn(record().id);
      if (r) setRecord(r);
      else setError("Nothing to undo");
      setChange(null);
    } catch (err) {
      fail(err);
    }
  };

  /** A newer copy arrived (agent over MCP, another tab): show what it changed. */
  const receive = (fresh: PathwayRecord) => {
    const cur = record();
    // Another map (Back after "Fresh map"): show it, whatever its age.
    if (fresh.id !== cur.id) {
      setChange(null);
      setLinkFrom(null);
      setRecord(fresh);
      setFitTick((t) => t + 1);
      return;
    }
    // Pending saves bring back the server's copy themselves.
    if (busy() || inFlight) return;
    if (fresh.updatedAt.getTime() <= cur.updatedAt.getTime()) {
      // Same map, but a linked task changed on the Tasks page: take its status.
      if (JSON.stringify(fresh.linked) !== JSON.stringify(cur.linked))
        setRecord((r) => ({ ...r, plan: fresh.plan, linked: fresh.linked }));
      return;
    }
    const c = diff(cur, fresh, "Changed elsewhere", "");
    if (c.added.length || c.newEdges.length || c.removed.length) setChange(c);
    setRecord(fresh);
  };

  /** Check off, skip, or record what happened. `coalesce` names a text field. */
  const updatePlanTask = (
    taskId: string,
    patch: Partial<Pick<PlanTask, "status" | "result">>,
    coalesce?: string,
  ) => {
    setRecord((r) => {
      if (!r.plan) return r;
      const tasks = r.plan.tasks.map((t) =>
        t.id === taskId ? { ...t, ...patch, absorbed: false } : t,
      );
      return { ...r, plan: { ...r.plan, tasks } };
    });
    save(updatePlanTaskFn({ id: record().id, taskId, ...patch, coalesce }));
  };

  /** Turns chosen Next steps into real tasks in one list. */
  const exportTasks = async (planTaskIds: string[], listId: string | null) => {
    setError("");
    try {
      setRecord(
        await exportPlanTasksFn({ id: record().id, planTaskIds, listId }),
      );
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  /**
   * A map just started from a task or note opens with ?draft=1: the agent
   * drafts the first map once, then the flag leaves the URL.
   */
  const draftOnOpen = () => {
    if (params.draft !== "1") return;
    setParams({ draft: undefined }, { replace: true });
    if (record().graph.nodes.length === 1) void runAgent("start", "root");
  };

  return {
    record,
    receive,
    draftOnOpen,
    selected,
    setSelected,
    openCard,
    split,
    view,
    setView,
    linkFrom,
    setLinkFrom,
    busy,
    error,
    setError,
    change,
    setChange,
    freshNodes,
    freshEdges,
    steer,
    setSteer,
    fitTick,
    setFitTick,
    titleFocus,
    setTitleFocus,
    edit,
    updateNode,
    setContext,
    addChild,
    link,
    unlink,
    removeNode,
    setResearch,
    runAgent,
    runResearch,
    undo,
    updatePlanTask,
    exportTasks,
  };
}

export type PathwayState = ReturnType<typeof createPathwayState>;
export const PathwayStateContext = createContext<PathwayState>();

export function usePathway() {
  const s = useContext(PathwayStateContext);
  if (!s) throw new Error("usePathway needs a PathwayStateContext provider");
  return s;
}

export const nodeById = (
  s: PathwayState,
  id: string | null | undefined,
): PathwayNode | undefined =>
  id ? s.record().graph.nodes.find((n) => n.id === id) : undefined;
