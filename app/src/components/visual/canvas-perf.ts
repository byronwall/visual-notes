type CanvasPerfMetric = {
  count: number;
  total: number;
  max: number;
  last: number;
};

const isBrowser = typeof window !== "undefined";

/** Accumulates timings on `window.__canvasPerf` for console inspection. */
export function trackCanvasPerf(name: string, duration: number) {
  if (!isBrowser || !Number.isFinite(duration)) return;
  const metricsHost = window as Window & {
    __canvasPerf?: Record<string, CanvasPerfMetric>;
  };
  const metrics = (metricsHost.__canvasPerf ??= {});
  const existing = metrics[name] ?? {
    count: 0,
    total: 0,
    max: 0,
    last: 0,
  };
  existing.count += 1;
  existing.total += duration;
  existing.max = Math.max(existing.max, duration);
  existing.last = duration;
  metrics[name] = existing;
}

export function measureCanvasWork<T>(name: string, fn: () => T) {
  if (!isBrowser || typeof performance === "undefined") {
    return fn();
  }
  const start = performance.now();
  const result = fn();
  trackCanvasPerf(name, performance.now() - start);
  return result;
}
