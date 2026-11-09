import { useAction } from "@solidjs/router";
import {
  BotIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
} from "lucide-solid";
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

const STATUS: Record<
  RequestStatus,
  { label: string; short: string; color: string; icon: typeof BotIcon }
> = {
  open: {
    label: "Waiting for an agent",
    short: "Waiting",
    color: "var(--colors-fg-muted)",
    icon: CircleDashedIcon,
  },
  claimed: {
    label: "In progress",
    short: "In progress",
    color: "var(--colors-blue-11)",
    icon: CircleDotIcon,
  },
  ready: {
    label: "Ready for review",
    short: "Ready",
    color: "var(--colors-green-11)",
    icon: CircleCheckIcon,
  },
  closed: {
    label: "Closed",
    short: "Closed",
    color: "var(--colors-fg-subtle)",
    icon: CircleCheckIcon,
  },
};

export const statusLabel = (
  request: Pick<AnnotationView, "status" | "claimedBy">,
) => {
  if (!request.status) return "";
  const base = STATUS[request.status].label;
  return request.status === "claimed" && request.claimedBy
    ? `${request.claimedBy} is on it`
    : base;
};

/** Status as an icon and colored text; no pill. `short` fits a narrow rail. */
export const RequestStatusBadge: VoidComponent<{
  request: AnnotationView;
  short?: boolean;
}> = (props) => (
  <Show when={props.request.status}>
    {(status) => {
      const Icon = STATUS[status()].icon;
      return (
        <HStack
          as="span"
          gap="1"
          data-testid="request-status"
          fontSize="xs"
          fontWeight="medium"
          whiteSpace="nowrap"
          style={{ color: STATUS[status()].color }}
          title={statusLabel(props.request)}
        >
          <Icon size={12} />
          {props.short
            ? status() === "claimed" && props.request.claimedBy
              ? `${props.request.claimedBy} on it`
              : STATUS[status()].short
            : statusLabel(props.request)}
        </HStack>
      );
    }}
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
      toaster.create({
        title: (error as Error).message || "Could not save",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const reply = () =>
    attempt(async () => {
      await runReply({ id: props.request.id, body: draft() });
      setDraft("");
    });

  const reopens = () =>
    props.request.status === "ready" || props.request.status === "closed";

  return (
    <Stack
      gap="1.5"
      mt="1"
      data-testid="request-thread"
      onClick={(event) => event.stopPropagation()}
    >
      <For each={props.request.messages}>
        {(message) => (
          <Box fontSize="sm" data-testid="request-message">
            <HStack gap="1" fontSize="xs" color="fg.muted" fontWeight="medium">
              <Show when={message.author !== "you"}>
                <BotIcon size={12} />
              </Show>
              {message.author === "you" ? "You" : message.author}
            </HStack>
            <Box whiteSpace="pre-wrap">{message.body}</Box>
          </Box>
        )}
      </For>
      <Textarea
        size="xs"
        rows={1}
        autoresize
        placeholder={reopens() ? "Reply to reopen…" : "Reply…"}
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey) &&
            draft().trim()
          )
            void reply();
        }}
      />
      <HStack gap="1" justify="flex-end" minH="6">
        <Show when={props.request.status !== "closed"}>
          <Button
            size="2xs"
            variant="plain"
            color="fg.muted"
            disabled={busy()}
            onClick={() => void attempt(() => runClose(props.request.id))}
          >
            Close request
          </Button>
        </Show>
        <Button
          size="2xs"
          disabled={busy() || !draft().trim()}
          onClick={() => void reply()}
        >
          Reply
        </Button>
      </HStack>
    </Stack>
  );
};
