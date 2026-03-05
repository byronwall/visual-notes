import { createEffect, createSignal, Show } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
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
      <Stack gap="2">
        <Input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          placeholder="List name"
          data-testid="task-list-name-input"
        />
        <Show when={error()}>
          {(message) => (
            <div style={{ color: "var(--colors-fg-error)", "font-size": "12px" }}>
              {message()}
            </div>
          )}
        </Show>
      </Stack>
    </SimpleDialog>
  );
};
