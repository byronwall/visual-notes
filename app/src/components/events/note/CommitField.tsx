import {
  Show,
  createEffect,
  createSignal,
  untrack,
  type VoidComponent,
} from "solid-js";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

/**
 * Text field that keeps its own draft and saves on blur or Enter, so a
 * refetch while typing never clobbers the draft.
 */
export const CommitField: VoidComponent<{
  value: string | null | undefined;
  onCommit: (next: string) => void;
  placeholder?: string;
  "aria-label": string;
  multiline?: boolean;
  type?: string;
}> = (props) => {
  const [draft, setDraft] = createSignal(untrack(() => props.value ?? ""));
  const [focused, setFocused] = createSignal(false);

  createEffect(() => {
    const next = props.value ?? "";
    if (!untrack(focused)) setDraft(next);
  });

  const commit = () => {
    setFocused(false);
    const next = draft().trim();
    if (next !== (props.value ?? "").trim()) props.onCommit(next);
  };

  const revert = (el: HTMLElement) => {
    setDraft(props.value ?? "");
    el.blur();
  };

  return (
    <Show
      when={props.multiline}
      fallback={
        <Input
          size="xs"
          type={props.type ?? "text"}
          value={draft()}
          placeholder={props.placeholder}
          aria-label={props["aria-label"]}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.preventDefault();
              revert(e.currentTarget);
            }
          }}
        />
      }
    >
      <Textarea
        size="xs"
        rows={2}
        resize="vertical"
        value={draft()}
        placeholder={props.placeholder}
        aria-label={props["aria-label"]}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            revert(e.currentTarget);
          }
        }}
      />
    </Show>
  );
};
