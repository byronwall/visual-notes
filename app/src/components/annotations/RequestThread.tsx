import { useAction } from "@solidjs/router";
import { createSignal, For, Show, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import type { AnnotationView, RequestStatus } from "~/lib/annotations/types";
import {
  closeRequestAction,
  replyToRequestAction,
} from "~/services/annotations/annotations.actions";

// A request's status, its reply thread, and the reply box. Used in the note
// rail, on tasks, and in the inbox.

const STATUS: Record<RequestStatus, { label: string; palette: string }> = {
  open: { label: "Waiting for an agent", palette: "gray" },
  claimed: { label: "In progress", palette: "blue" },
  ready: { label: "Ready for review", palette: "green" },
  closed: { label: "Closed", palette: "gray" },
};

export const statusLabel = (request: Pick<AnnotationView, "status" | "claimedBy">) => {
  if (!request.status) return "";
  const base = STATUS[request.status].label;
  return request.status === "claimed" && request.claimedBy ? `${request.claimedBy} is on it` : base;
};

export const RequestStatusBadge: VoidComponent<{ request: AnnotationView }> = (props) => (
  <Show when={props.request.status}>
    {(status) => (
      <Box
        as="span"
        data-testid="request-status"
        px="1.5"
        py="0.5"
        borderRadius="l1"
        fontSize="xs"
        fontWeight="semibold"
        whiteSpace="nowrap"
        style={{
          "background-color": `var(--colors-${STATUS[status()].palette}-a3)`,
          color: `var(--colors-${STATUS[status()].palette}-11)`,
        }}
      >
        {statusLabel(props.request)}
      </Box>
    )}
  </Show>
);

export const RequestThread: VoidComponent<{
  request: AnnotationView;
  onChanged?: () => void;
}> = (props) => {
  const runReply = useAction(replyToRequestAction);
  const runClose = useAction(closeRequestAction);
  const [draft, setDraft] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const attempt = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      props.onChanged?.();
    } catch (error) {
      toaster.create({ title: (error as Error).message || "Could not save", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const reply = () =>
    attempt(async () => {
      await runReply({ id: props.request.id, body: draft() });
      setDraft("");
    });

  return (
    <Stack gap="1.5" mt="1.5" data-testid="request-thread" onClick={(event) => event.stopPropagation()}>
      <For each={props.request.messages}>
        {(message) => (
          <Box
            fontSize="sm"
            pl="2"
            borderLeftWidth="2px"
            borderColor={message.author === "you" ? "border" : "green.7"}
            data-testid="request-message"
          >
            <Box fontSize="2xs" color="fg.muted" fontWeight="semibold">
              {message.author === "you" ? "You" : message.author}
            </Box>
            <Box whiteSpace="pre-wrap">{message.body}</Box>
          </Box>
        )}
      </For>
      <Textarea
        size="sm"
        rows={1}
        autoresize
        placeholder={props.request.status === "ready" || props.request.status === "closed" ? "Reply to reopen" : "Reply"}
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && draft().trim()) void reply();
        }}
      />
      <HStack gap="1.5" justify="flex-end">
        <Show when={props.request.status !== "closed"}>
          <Button size="2xs" variant="outline" disabled={busy()} onClick={() => void attempt(() => runClose(props.request.id))}>
            Close
          </Button>
        </Show>
        <Button size="2xs" disabled={busy() || !draft().trim()} onClick={() => void reply()}>
          Reply
        </Button>
      </HStack>
    </Stack>
  );
};
