import { onCleanup } from "solid-js";

export function useAbortableFetch() {
  let controller: AbortController | undefined;

  const withAbort = async <T>(fn: (signal: AbortSignal) => Promise<T>) => {
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      return await fn(controller.signal);
    } finally {
      // keep controller for explicit aborts if needed
    }
  };

  const abort = () => controller?.abort();

  onCleanup(abort);
  return { withAbort, abort };
}
