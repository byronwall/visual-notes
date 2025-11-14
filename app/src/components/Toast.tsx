import {
  createContext,
  useContext,
  JSX,
  For,
  createSignal,
  onCleanup,
} from "solid-js";
import { createStore } from "solid-js/store";

type Toast = {
  id: string;
  title?: string;
  message: string;
  createdAt: number;
  onClick?: () => void;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (opts: {
    message: string;
    title?: string;
    timeoutMs?: number;
    onClick?: () => void;
  }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue>();

export function ToastProvider(props: { children: JSX.Element }) {
  const [toasts, setToasts] = createStore<Toast[]>([]);

  const dismiss = (id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  };
  const show: ToastContextValue["show"] = ({
    message,
    title,
    timeoutMs = 6000,
    onClick,
  }) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const t: Toast = { id, message, title, createdAt: Date.now(), onClick };
    setToasts((list) => [t, ...list].slice(0, 5));
    const timeout = setTimeout(() => dismiss(id), timeoutMs);
    // Best-effort cleanup if manually dismissed
    const stop = () => clearTimeout(timeout);
    // No direct per-toast cleanup hook here; acceptable for small counts
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    stop;
  };

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {props.children}
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within <ToastProvider>");
  return ctx;
}

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  // Simple auto-trim of very old toasts
  const [tick, setTick] = createSignal(0);
  const iv = setInterval(() => setTick((n) => (n + 1) % 1000), 1000);
  onCleanup(() => clearInterval(iv));
  tick(); // keep reactive

  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
      <For each={toasts}>
        {(t) => (
          <button
            type="button"
            class="text-left rounded shadow-md border border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => {
              if (t.onClick) {
                console.log("[Toast] Clicked toast", {
                  id: t.id,
                  title: t.title,
                });
                t.onClick();
              }
              dismiss(t.id);
            }}
          >
            <div class="flex items-start gap-2">
              <div class="mt-1 h-2 w-2 rounded-full bg-blue-600" />
              <div class="flex-1">
                {t.title ? <div class="font-medium">{t.title}</div> : null}
                <div class="text-sm text-gray-700">{t.message}</div>
              </div>
              <button
                class="text-xs text-gray-500 hover:text-gray-800"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(t.id);
                }}
              >
                ×
              </button>
            </div>
          </button>
        )}
      </For>
    </div>
  );
}
