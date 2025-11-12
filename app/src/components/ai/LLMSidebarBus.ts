type LLMSidebarEvent =
  | { type: "open"; threadId?: string };

type Listener = (e: LLMSidebarEvent) => void;

const listeners: Set<Listener> = new Set();

export function onLLMSidebarEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLLMSidebarOpen(threadId?: string): void {
  const evt: LLMSidebarEvent = { type: "open", threadId };
  for (const l of listeners) l(evt);
}


