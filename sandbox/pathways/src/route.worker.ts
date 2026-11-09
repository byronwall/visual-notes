// Routes edges off the main thread. The router takes about 1–2s for 30 cards.
import { RouteLab } from "./engines/routing-engine.js";
import { roundedPath } from "./layout";

type Request = { id: number; sig: string; input: Parameters<typeof RouteLab.compute>[0] };

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, sig, input } = e.data;
  const t0 = performance.now();
  const { routes } = RouteLab.compute(input, { direction: "right" });
  const paths = routes.map((r) => [r.id, roundedPath(r.points, 8)] as const);
  self.postMessage({ id, sig, paths, ms: Math.round(performance.now() - t0) });
};
