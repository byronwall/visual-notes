import { createEffect, createSignal, on, onCleanup, type Accessor } from "solid-js";
import { elbowPath, routeInput, type Box, type Placed } from "./layout";
import type { PMap } from "./types";

type Paths = Map<string, string>;

/**
 * Edge paths for a placement. Edges show at once (the old route when both
 * cards stayed put, else an elbow), then the worker's routed paths replace
 * them. A newer placement terminates a route still in progress.
 */
export function useRoutes(placed: Accessor<Placed | null>, map: Accessor<PMap | null>) {
  const [paths, setPaths] = createSignal<Paths>(new Map());
  const cache = new Map<string, Paths>();
  let worker: Worker | null = null;
  let busy = false;
  let reqId = 0;
  let lastBoxes = new Map<string, Box>();

  const spawn = () => {
    worker = new Worker(new URL("./route.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; sig: string; paths: [string, string][]; ms: number }>) => {
      busy = false;
      const routed = new Map(e.data.paths);
      cache.set(e.data.sig, routed);
      if (cache.size > 30) cache.delete(cache.keys().next().value!);
      console.debug(`[pathways] routed ${routed.size} edges in ${e.data.ms}ms`);
      if (e.data.id === reqId) setPaths(routed);
    };
  };
  spawn();
  onCleanup(() => worker?.terminate());

  const same = (a?: Box, b?: Box) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

  createEffect(
    on(placed, (p) => {
      const m = map();
      if (!p || !m) return;
      const hit = cache.get(p.sig);
      if (hit) {
        reqId++;
        setPaths(hit);
        lastBoxes = p.boxes;
        return;
      }
      const prev = paths();
      const now: Paths = new Map();
      for (const e of m.edges) {
        const a = p.boxes.get(e.from);
        const b = p.boxes.get(e.to);
        if (!a || !b) continue;
        const key = `${e.from}>${e.to}`;
        const kept = prev.get(key);
        now.set(key, kept && same(lastBoxes.get(e.from), a) && same(lastBoxes.get(e.to), b) ? kept : elbowPath(a, b));
      }
      setPaths(now);
      lastBoxes = p.boxes;
      if (busy) {
        worker!.terminate();
        spawn();
      }
      busy = true;
      worker!.postMessage({ id: ++reqId, sig: p.sig, input: routeInput(p, m) });
    }),
  );

  return paths;
}
