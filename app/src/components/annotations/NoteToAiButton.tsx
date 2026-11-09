import { revalidate, useAction } from "@solidjs/router";
import { BotMessageSquareIcon } from "lucide-solid";
import { createSignal, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { createAiRequest } from "~/services/annotations/annotations.actions";
import {
  fetchNoteAnnotations,
  fetchTaskAnnotations,
} from "~/services/annotations/annotations.queries";

// "Note to AI": a one-line request on a whole note or a task that polling
// agents pick up from the inbox.

const EXAMPLES = [
  "Research this",
  "Follow up on this",
  "Expand this",
  "Find newer sources",
];

export const NoteToAiForm: VoidComponent<{
  target: { docId: string } | { taskId: string };
  onDone: () => void;
}> = (props) => {
  const runCreate = useAction(createAiRequest);
  const [body, setBody] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const send = async () => {
    if (!body().trim() || saving()) return;
    setSaving(true);
    try {
      await runCreate({ ...props.target, body: body() });
      if ("docId" in props.target)
        void revalidate(fetchNoteAnnotations.keyFor(props.target.docId));
      else void revalidate(fetchTaskAnnotations.keyFor(props.target.taskId));
      toaster.create({ title: "Sent to the agent inbox", type: "success" });
      setBody("");
      props.onDone();
    } catch (error) {
      toaster.create({
        title: (error as Error).message || "Could not send",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="2" data-testid="note-to-ai-form">
      <Box fontSize="sm" fontWeight="semibold">
        Note to AI
      </Box>
      <Textarea
        size="sm"
        rows={3}
        autofocus
        placeholder="What should an agent do with this?"
        value={body()}
        onInput={(event) => setBody(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
            void send();
        }}
      />
      <HStack gap="1" flexWrap="wrap">
        {EXAMPLES.map((example) => (
          <Button size="2xs" variant="outline" onClick={() => setBody(example)}>
            {example}
          </Button>
        ))}
      </HStack>
      <HStack justify="flex-end" gap="2">
        <Button size="xs" variant="outline" onClick={() => props.onDone()}>
          Cancel
        </Button>
        <Button
          size="xs"
          loading={saving()}
          disabled={!body().trim()}
          onClick={() => void send()}
        >
          Send
        </Button>
      </HStack>
    </Stack>
  );
};

/**
 * Header button on a note. It renders on the server like the other header
 * actions; with the inbox off, sending reports that instead.
 */
export const NoteToAiButton: VoidComponent<{ docId: string }> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={6}
      style={{ width: "min(22rem, 92vw)" }}
      anchor={
        <Tooltip
          content="Note to AI"
          showArrow
          portalled={false}
          contentProps={{ zIndex: "tooltip" }}
        >
          <IconButton
            size="sm"
            variant="plain"
            aria-label="Note to AI"
            data-testid="note-to-ai-button"
            onClick={() => setOpen((v) => !v)}
          >
            <BotMessageSquareIcon size={16} />
          </IconButton>
        </Tooltip>
      }
    >
      <Box p="3">
        <NoteToAiForm
          target={{ docId: props.docId }}
          onDone={() => setOpen(false)}
        />
      </Box>
    </SimplePopover>
  );
};
