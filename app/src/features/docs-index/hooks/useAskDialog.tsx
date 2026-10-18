import { Show, createSignal } from "solid-js";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";

export type AskOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Ask for a single text value instead of a yes/no. */
  input?: { placeholder?: string };
};

type Pending = AskOptions & { resolve: (value: string | null) => void };

/**
 * Promise-based replacement for window.confirm/prompt using the app dialog.
 * `confirm` resolves true/false; `promptText` resolves the trimmed value or null.
 */
export const useAskDialog = () => {
  const [pending, setPending] = createSignal<Pending | null>(null);
  const [text, setText] = createSignal("");
  let inputEl: HTMLInputElement | undefined;

  const open = (opts: AskOptions) =>
    new Promise<string | null>((resolve) => {
      pending()?.resolve(null);
      setText("");
      setPending({ ...opts, resolve });
    });

  const settle = (value: string | null) => {
    const current = pending();
    if (!current) return;
    setPending(null);
    current.resolve(value);
  };

  const confirm = async (opts: Omit<AskOptions, "input">) =>
    (await open(opts)) !== null;

  const promptText = async (opts: AskOptions) => {
    const value = await open({ ...opts, input: opts.input ?? {} });
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const AskDialogHost = () => (
    <Show when={pending()}>
      {(p) => (
        <ConfirmDialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) settle(null);
          }}
          title={p().title}
          description={p().description}
          confirmLabel={p().confirmLabel}
          confirmColorPalette={p().danger ? "red" : undefined}
          onConfirm={() => settle(p().input ? text() : "")}
          initialFocusEl={p().input ? () => inputEl ?? null : undefined}
        >
          <Show when={p().input}>
            {(input) => (
              <Input
                ref={inputEl}
                size="sm"
                placeholder={input().placeholder}
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text().trim()) settle(text());
                }}
              />
            )}
          </Show>
        </ConfirmDialog>
      )}
    </Show>
  );

  return { confirm, promptText, AskDialogHost };
};
