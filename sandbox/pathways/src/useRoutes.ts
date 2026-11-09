import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js";
import { elbowPaths, routeInput, type Box, type Placed } from "./layout";
import type { PMap } from "./types";

type Paths = Map<string, string>;
type Reply = { id: number; sig: string; paths: [string, string][]; quick: boolean; ms: number };

/**
 * Edge paths for a placement. Edges show at once (the old route when both
 * cards stayed put, else a spread-out elbow), then the worker's quick pass
 * and full pass replace them. A newer placement terminates a route still in
 * progress. `prefetch` routes another placement (the other zoom layout) in
 * a second worker, so switching to it is instant.
 */
export function useRoutes(placed: Accessor<Placed | null>, map: Accessor<PMap | null>) {
  const [paths, setPaths] = createSignal<Paths>(new Map());
  const cache = new Map<string, Paths>();
  const remember = (sig: string, routed: Paths) => {
    cache.set(sig, routed);
    if (cache.size > 30) cache.delete(cache.keys().next().value!);
  };
  let reqId = 0;
  let busy = false;
  let lastBoxes = new Map<string, Box>();
  let shown = "";

  const makeWorker = () => new Worker(new URL("./route.worker.ts", import.meta.url), { type: "module" });

  let worker!: Worker;
  const spawn = () => {
    worker = makeWorker();
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const routed = new Map(e.data.paths);
      if (!e.data.quick) {
        busy = false;
        remember(e.data.sig, routed);
        console.debug(`[pathways] routed ${routed.size} edges in ${e.data.ms}ms`);
      }
      if (e.data.id === reqId) setPaths(routed);
    };
  };
  spawn();

  // Background routing for the layout you are not looking at yet.
  const pre = makeWorker();
  const pending = new Set<string>();
  pre.onmessage = (e: MessageEvent<Reply>) => {
    if (e.data.quick) return;
    pending.delete(e.data.sig);
    remember(e.data.sig, new Map(e.data.paths));
    // It finished before the main worker: use it.
    if (e.data.sig === shown && busy) {
      busy = false;
      reqId++;
      worker.terminate();
      spawn();
      setPaths(cache.get(e.data.sig)!);
    }
  };
  onCleanup(() => {
    worker.terminate();
    pre.terminate();
  });

  const same = (a?: Box, b?: Box) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  createEffect(
    on(placed, (p) => {
      const m = map();
      if (!p || !m) return;
      shown = p.sig;
      const hit = cache.get(p.sig);
      if (hit) {
        reqId++;
        setPaths(hit);
        lastBoxes = p.boxes;
        return;
      }
      const prev = paths();
      const elbows = elbowPaths(p, m);
      const now: Paths = new Map();
      for (const [key, elbow] of elbows) {
        const [from, to] = key.split(">");
        const kept = prev.get(key);
        now.set(key, kept && same(lastBoxes.get(from), p.boxes.get(from)) && same(lastBoxes.get(to), p.boxes.get(to)) ? kept : elbow);
      }
      setPaths(now);
      lastBoxes = p.boxes;
      if (pending.has(p.sig)) return; // the background worker is already on it
      if (busy) {
        worker.terminate();
        spawn();
      }
      busy = true;
      worker.postMessage({ id: ++reqId, sig: p.sig, input: routeInput(p, m) });
    }),
  );

  const prefetch = (p: Placed, m: PMap) => {
    if (cache.has(p.sig) || pending.has(p.sig)) return;
    pending.add(p.sig);
    pre.postMessage({ id: 0, sig: p.sig, input: routeInput(p, m) });
  };

  return { paths, prefetch };
}
