import { createEffect, createSignal, on, onCleanup } from "solid-js";

/**
 * True while a nested dialog is open and briefly after it closes. Pass the
 * inverse to the parent's `closeOnInteractOutside`: the click that closes
 * the nested dialog otherwise lands as an outside interaction on the parent
 * and dismisses it too.
 */
export const useNestedDialogGuard = (nestedOpen: () => boolean) => {
  const [guarding, setGuarding] = createSignal(false);
  createEffect(
    on(nestedOpen, (open) => {
      if (open) {
        setGuarding(true);
        return;
      }
      const timeout = window.setTimeout(() => setGuarding(false), 250);
      onCleanup(() => window.clearTimeout(timeout));
    }),
  );
  return guarding;
};
