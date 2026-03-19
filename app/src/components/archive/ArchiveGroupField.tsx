import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import { XIcon } from "lucide-solid";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";

export const ArchiveGroupField = (props: {
  value: string;
  options: string[];
  placeholder?: string;
  onCommit: (value: string) => void | Promise<void>;
}) => {
  const listId = `archive-group-field-options-${createUniqueId()}`;
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  createEffect(() => {
    if (editing()) return;
    setDraft(props.value);
  });

  const commit = async () => {
    await props.onCommit(draft());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(props.value);
    setEditing(false);
  };

  return (
    <Show
      when={editing()}
      fallback={
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setEditing(true)}
        >
          {props.value || props.placeholder || "Assign group"}
        </Button>
      }
    >
      <HStack gap="1" minW="0">
        <Input
          list={listId}
          value={draft()}
          placeholder={props.placeholder || "Group name"}
          size="sm"
          onInput={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        />
        <datalist id={listId}>
          <For each={props.options}>{(option) => <option value={option} />}</For>
        </datalist>
        <IconButton
          type="button"
          variant="plain"
          size="xs"
          aria-label="Cancel group edit"
          onMouseDown={(event) => event.preventDefault()}
          onClick={cancel}
        >
          <XIcon size={14} />
        </IconButton>
      </HStack>
    </Show>
  );
};
