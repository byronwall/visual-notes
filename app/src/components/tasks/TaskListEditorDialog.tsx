import { createEffect, createSignal, Show } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export const TaskListEditorDialog = (props: Props) => {
  const [name, setName] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let nameInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (!props.open) return;
    setName("");
    setError(null);
    setSubmitting(false);
  });

  const handleSubmit = async () => {
    const value = name().trim();
    if (!value) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await props.onSubmit(value);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save list");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      initialFocusEl={() => nameInputRef ?? null}
      title="Create Task List"
      description="Task lists are independent containers for hierarchies of tasks."
      footer={
        <HStack gap="2" justifyContent="flex-end">
          <Button variant="outline" onClick={props.onClose} disabled={submitting()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting()}>
            Save
          </Button>
        </HStack>
      }
    >
      <Field.Root invalid={!!error()}>
        <Stack gap="2">
          <Field.Label for="task-list-name">List name</Field.Label>
          <Input
            id="task-list-name"
            ref={nameInputRef}
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void handleSubmit();
            }}
            placeholder="Weekly planning"
            data-testid="task-list-name-input"
          />
          <Show when={error()}>
            {(message) => <Field.ErrorText>{message()}</Field.ErrorText>}
          </Show>
        </Stack>
      </Field.Root>
    </SimpleDialog>
  );
};
