// Routes edges off the main thread. The router takes about 1–2s for 30 cards.
import { RouteLab } from "./engine/routing-engine.js";
import { roundedPath } from "./layout";

type Request = {
  id: number;
  sig: string;
  input: Parameters<typeof RouteLab.compute>[0];
};

// A quick pass (~0.2s) goes out first, then the full pass (~2s) replaces it.
self.onmessage = (e: MessageEvent<Request>) => {
  const { id, sig, input } = e.data;
  for (const quick of [true, false]) {
    const t0 = performance.now();
    const { routes } = RouteLab.compute(input, { direction: "right", quick });
    const paths = routes.map((r) => [r.id, roundedPath(r.points, 8)] as const);
    self.postMessage({
      id,
      sig,
      paths,
      quick,
      ms: Math.round(performance.now() - t0),
    });
  }
};
