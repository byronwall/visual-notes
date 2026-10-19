import { revalidate, useAction } from "@solidjs/router";
import { Show, createEffect, createSignal, on } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { deletePrompt, updatePrompt } from "~/services/prompts/prompts.actions";
import { fetchPrompts } from "~/services/prompts/prompts.queries";
import type { DashboardPrompt } from "./ai-dashboard-model";

type PromptDialogProps = {
  prompt: DashboardPrompt | null;
  onClose: () => void;
};

export const PromptEditDialog = (props: PromptDialogProps) => {
  const runUpdatePrompt = useAction(updatePrompt);
  const [task, setTask] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(
    on(
      () => props.prompt,
      (prompt) => {
        setTask(prompt?.task ?? "");
        setDescription(prompt?.description ?? "");
        setError("");
      },
    ),
  );

  const save = async () => {
    const prompt = props.prompt;
    if (!prompt) return;
    const nextTask = task().trim();
    if (!nextTask) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nextDescription = description().trim();
      await runUpdatePrompt({
        id: prompt.id,
        task: nextTask,
        description: nextDescription.length ? nextDescription : null,
      });
      await revalidate(fetchPrompts.key);
      props.onClose();
    } catch (err) {
      setError((err as Error)?.message || "Failed to save prompt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SimpleDialog
      open={Boolean(props.prompt)}
      onClose={props.onClose}
      title="Edit prompt"
      maxW="520px"
      footer={
        <HStack justify="space-between" gap="2" w="full">
          <Button variant="plain" onClick={props.onClose}>
            Cancel
          </Button>
          <Button loading={busy()} onClick={() => void save()}>
            Save
          </Button>
        </HStack>
      }
    >
      <Stack gap="3">
        <Stack gap="1">
          <Text textStyle="xs" color="fg.muted">
            Name
          </Text>
          <Input
            fontFamily="mono"
            value={task()}
            onInput={(event) => setTask(event.currentTarget.value)}
          />
        </Stack>
        <Stack gap="1">
          <Text textStyle="xs" color="fg.muted">
            Description
          </Text>
          <Textarea
            value={description()}
            onInput={(event) => setDescription(event.currentTarget.value)}
            minH="6rem"
          />
        </Stack>
        <Show when={error()}>
          {(message) => (
            <Text textStyle="xs" color="error">
              {message()}
            </Text>
          )}
        </Show>
      </Stack>
    </SimpleDialog>
  );
};

export const PromptDeleteDialog = (props: PromptDialogProps) => {
  const runDeletePrompt = useAction(deletePrompt);
  const [busy, setBusy] = createSignal(false);

  const confirm = async () => {
    const prompt = props.prompt;
    if (!prompt) return;
    setBusy(true);
    try {
      await runDeletePrompt({ id: prompt.id });
      console.info("[ai-dashboard] deleted prompt", prompt.id);
      await revalidate(fetchPrompts.key);
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(props.prompt)}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title="Delete prompt"
      description={`Delete "${props.prompt?.task ?? ""}" and all of its versions and runs?`}
      confirmLabel={busy() ? "Deleting…" : "Delete prompt"}
      onConfirm={() => void confirm()}
    >
      <Text textStyle="sm" color="fg.muted">
        This action cannot be undone.
      </Text>
    </ConfirmDialog>
  );
};
