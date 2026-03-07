import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Collapsible from "~/components/ui/collapsible";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import {
  TASK_STATUSES,
  type TaskItem,
  type TaskStatus,
} from "~/services/tasks/tasks.service";

type TaskEditorSubmit = {
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  durationMinutes: number | null;
  tags: string[];
  meta: Record<string, string> | null;
  parentTaskId: string | null;
};

type ParentOption = {
  id: string;
  label: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  task: TaskItem | null;
  parentTaskId: string | null;
  parentOptions: ParentOption[];
  onClose: () => void;
  onSubmit: (value: TaskEditorSubmit) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const parseMetaText = (text: string): Record<string, string> | null => {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (entries.length === 0) return null;

  const result: Record<string, string> = {};
  for (const line of entries) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      result[line] = "";
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
};

const formatMeta = (meta: Record<string, string> | null) => {
  if (!meta) return "";
  return Object.entries(meta)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
};

export const TaskEditorDialog = (props: Props) => {
  const [description, setDescription] = createSignal("");
  const [status, setStatus] = createSignal<TaskStatus>("waiting");
  const [dueDate, setDueDate] = createSignal("");
  const [durationMinutes, setDurationMinutes] = createSignal("");
  const [tags, setTags] = createSignal("");
  const [metaText, setMetaText] = createSignal("");
  const [selectedParent, setSelectedParent] = createSignal<string>("");
  const [submitting, setSubmitting] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  let descriptionRef: HTMLTextAreaElement | undefined;

  const dialogTitle = createMemo(() =>
    props.mode === "create" ? "Create Task" : "Edit Task"
  );

  createEffect(() => {
    if (!props.open) return;
    setDescription(props.task?.description || "");
    setStatus(props.task?.status || "waiting");
    setDueDate(props.task?.dueDate || "");
    setDurationMinutes(props.task?.durationMinutes?.toString() || "");
    setTags((props.task?.tags || []).join(", "));
    setMetaText(formatMeta(props.task?.meta || null));
    setSelectedParent(props.parentTaskId || "");
    setSubmitting(false);
    setDeleting(false);
    setError(null);
    setShowAdvanced(!!props.task?.tags.length || !!props.task?.meta);
  });

  const statusItems = createMemo(() =>
    TASK_STATUSES.map((item) => ({ label: item, value: item }))
  );

  const parentItems = createMemo(() => [
    { label: "No parent", value: "" },
    ...props.parentOptions.map((option) => ({
      label: option.label,
      value: option.id,
    })),
  ]);

  const handleSave = async () => {
    if (!description().trim()) {
      setError("Description is required");
      return;
    }

    const parsedDuration = durationMinutes().trim();
    const duration = parsedDuration ? Number(parsedDuration) : null;
    if (duration !== null && (!Number.isFinite(duration) || duration < 1)) {
      setError("Duration must be a positive number of minutes");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await props.onSubmit({
        description: description().trim(),
        status: status(),
        dueDate: dueDate().trim() || null,
        durationMinutes: duration,
        tags: tags()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        meta: parseMetaText(metaText()),
        parentTaskId: selectedParent().trim() || null,
      });
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!props.onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await props.onDelete();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      onClose={props.onClose}
      initialFocusEl={() => descriptionRef ?? null}
      title={dialogTitle()}
      footer={
        <HStack justifyContent="space-between" gap="2">
          <Show when={props.mode === "edit" && props.onDelete}>
            <Button
              variant="outline"
              colorPalette="red"
              onClick={handleDelete}
              loading={deleting()}
              data-testid="task-delete-button"
            >
              Delete
            </Button>
          </Show>
          <HStack gap="2" ml="auto">
            <Button variant="outline" onClick={props.onClose} disabled={submitting() || deleting()}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={submitting()} data-testid="task-save-button">
              Save
            </Button>
          </HStack>
        </HStack>
      }
    >
      <Stack gap="3" data-testid="task-edit-dialog">
        <Field.Root invalid={!!error()}>
          <Stack gap="1.5">
            <Field.Label for="task-description">Task description</Field.Label>
            <Textarea
              id="task-description"
              ref={descriptionRef}
              value={description()}
              onInput={(event) => setDescription(event.currentTarget.value)}
              placeholder="What needs to get done?"
              rows={3}
            />
          </Stack>
        </Field.Root>

        <Grid
          gap="3"
          gridTemplateColumns={{
            base: "1fr",
            md: "repeat(3, minmax(0, 1fr))",
          }}
          alignItems="start"
        >
          <Field.Root>
            <Stack gap="1.5">
              <Field.Label>Status</Field.Label>
              <SimpleSelect
                items={statusItems()}
                value={status()}
                onChange={(value) => setStatus(value as TaskStatus)}
                sameWidth
              />
            </Stack>
          </Field.Root>

          <Field.Root>
            <Stack gap="1.5">
              <Field.Label for="task-due-date">Due date</Field.Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate()}
                onInput={(event) => setDueDate(event.currentTarget.value)}
                data-testid="task-due-date-input"
              />
            </Stack>
          </Field.Root>

          <Field.Root>
            <Stack gap="1.5">
              <Field.Label for="task-duration">Duration (minutes)</Field.Label>
              <Input
                id="task-duration"
                type="number"
                min="1"
                value={durationMinutes()}
                onInput={(event) => setDurationMinutes(event.currentTarget.value)}
                placeholder="30"
                data-testid="task-duration-input"
              />
            </Stack>
          </Field.Root>
        </Grid>

        <Field.Root>
          <Stack gap="1.5">
            <Field.Label>Parent task</Field.Label>
            <SimpleSelect
              items={parentItems()}
              value={selectedParent()}
              onChange={setSelectedParent}
              placeholder="No parent"
              sameWidth
            />
          </Stack>
        </Field.Root>

        <Collapsible.Root open={showAdvanced()} onOpenChange={(details) => setShowAdvanced(details.open)}>
          <Stack gap="2">
            <Collapsible.Trigger asChild={(triggerProps) => (
              <Button
                {...triggerProps()}
                type="button"
                variant="plain"
                justifyContent="space-between"
                px="0"
              >
                <span>Advanced details</span>
                <Show when={showAdvanced()} fallback={<ChevronRightIcon size={16} />}>
                  <ChevronDownIcon size={16} />
                </Show>
              </Button>
            )} />

            <Collapsible.Content>
              <Stack gap="3" pt="1">
                <Field.Root>
                  <Stack gap="1.5">
                    <Field.Label for="task-tags">Tags (comma separated)</Field.Label>
                    <Input
                      id="task-tags"
                      value={tags()}
                      onInput={(event) => setTags(event.currentTarget.value)}
                      placeholder="ops, deep-work"
                      data-testid="task-tags-input"
                    />
                  </Stack>
                </Field.Root>

                <Field.Root>
                  <Stack gap="1.5">
                    <Field.Label for="task-meta">
                      Metadata (one per line: key: value)
                    </Field.Label>
                    <Textarea
                      id="task-meta"
                      rows={4}
                      value={metaText()}
                      onInput={(event) => setMetaText(event.currentTarget.value)}
                      placeholder="owner: byron\npriority: high"
                      data-testid="task-meta-input"
                    />
                  </Stack>
                </Field.Root>
              </Stack>
            </Collapsible.Content>
          </Stack>
        </Collapsible.Root>

        <Show when={error()}>
          {(message) => <Field.ErrorText>{message()}</Field.ErrorText>}
        </Show>
      </Stack>
    </SimpleDialog>
  );
};
