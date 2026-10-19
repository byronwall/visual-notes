import { toaster } from "~/components/ui/toast";

type ShowToastOptions = {
  message: string;
  title?: string;
  timeoutMs?: number;
  /** When set, the toast gets an action button that runs this callback. */
  onClick?: () => void;
  actionLabel?: string;
  type?: "info" | "success" | "warning" | "error";
};

type ToastApi = {
  show: (opts: ShowToastOptions) => string;
  dismiss: (id: string) => void;
};

const show = (opts: ShowToastOptions): string => {
  const onClick = opts.onClick;
  return toaster.create({
    title: opts.title,
    description: opts.message,
    type: opts.type ?? "info",
    duration: opts.timeoutMs ?? 6000,
    closable: true,
    action: onClick
      ? { label: opts.actionLabel ?? "Open", onClick }
      : undefined,
  });
};

const dismiss = (id: string) => {
  toaster.dismiss(id);
};

const api: ToastApi = { show, dismiss };

/**
 * Thin adapter over the app-wide Ark toaster (`~/components/ui/toast`), which
 * is mounted once in `app.tsx`. Keeps the `{ message, title, onClick }` API.
 */
export function useToasts(): ToastApi {
  return api;
}
