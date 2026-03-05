import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  });

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
        <Textarea
          value={description()}
          onInput={(event) => setDescription(event.currentTarget.value)}
          placeholder="Task description"
          rows={3}
        />

        <HStack gap="2" alignItems="flex-start">
          <Stack gap="1" flex="1">
            <label>Status</label>
            <select
              value={status()}
              onChange={(event) => setStatus(event.currentTarget.value as TaskStatus)}
              data-testid="task-status-select"
            >
              <For each={TASK_STATUSES}>
                {(item) => <option value={item}>{item}</option>}
              </For>
            </select>
          </Stack>

          <Stack gap="1" flex="1">
            <label>Due Date</label>
            <Input
              type="date"
              value={dueDate()}
              onInput={(event) => setDueDate(event.currentTarget.value)}
              data-testid="task-due-date-input"
            />
          </Stack>

          <Stack gap="1" flex="1">
            <label>Duration (minutes)</label>
            <Input
              type="number"
              min="1"
              value={durationMinutes()}
              onInput={(event) => setDurationMinutes(event.currentTarget.value)}
              data-testid="task-duration-input"
            />
          </Stack>
        </HStack>

        <Stack gap="1">
          <label>Parent Task</label>
          <select
            value={selectedParent()}
            onChange={(event) => setSelectedParent(event.currentTarget.value)}
            data-testid="task-parent-select"
          >
            <option value="">No parent</option>
            <For each={props.parentOptions}>
              {(option) => <option value={option.id}>{option.label}</option>}
            </For>
          </select>
        </Stack>

        <Stack gap="1">
          <label>Tags (comma separated)</label>
          <Input
            value={tags()}
            onInput={(event) => setTags(event.currentTarget.value)}
            placeholder="ops, deep-work"
            data-testid="task-tags-input"
          />
        </Stack>

        <Stack gap="1">
          <label>Metadata (one per line: key: value)</label>
          <Textarea
            rows={4}
            value={metaText()}
            onInput={(event) => setMetaText(event.currentTarget.value)}
            placeholder="owner: byron\npriority: high"
            data-testid="task-meta-input"
          />
        </Stack>

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
